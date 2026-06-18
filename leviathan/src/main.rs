use axum::{
    extract::{
        ws::{Message, WebSocket},
        State, WebSocketUpgrade,
    },
    response::IntoResponse,
    routing::get,
    Router,
};
use futures_util::{stream::StreamExt, SinkExt};
use serde::{Deserialize, Serialize};
use std::{net::SocketAddr, sync::Arc, time::Duration};
use tokio::sync::{oneshot, Mutex};
use tokio::time::interval;
use tracing::{error, info, instrument};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

// Shared state for the server
#[derive(Default)]
struct ServerState {
    // A one-shot channel sender to notify a waiting player when an opponent is found.
    waiting_player: Mutex<Option<oneshot::Sender<WebSocket>>>,
}

#[derive(Serialize, Debug, Clone, Copy)]
enum PlayerRole {
    SHIPS,
    SUBMARINE,
}

/// Messages sent from the server to the client.
#[derive(Serialize, Debug)]
#[serde(tag = "type")]
enum ServerMessage {
    #[serde(rename = "role_assignment")]
    RoleAssignment { role: PlayerRole },
    #[serde(rename = "game_over")]
    GameOver { reason: String },
    #[serde(rename = "game_state")]
    GameState(GameState),
}

/// A snapshot of a player's state, to be sent to clients.
#[derive(Serialize, Debug, Clone, Copy)]
struct PlayerState {
    id: u8,
    role: PlayerRole,
    angle: f64,
    hp: i32,
}

/// The authoritative state of the entire game world.
#[derive(Serialize, Debug, Default, Clone)]
pub struct GameState {
    players: Vec<PlayerState>,
    // We will add torpedoes, ships, etc. here in the next steps.
}

/// Messages sent from the client to the server.
#[derive(Deserialize, Debug)]
#[serde(tag = "type")]
enum ClientMessage {
    /// A player action, like shooting.
    #[serde(rename = "action")]
    Action {
        angle: f64,
    },
}

#[tokio::main]
async fn main() {
    // Setup logging to trace events
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "leviathan=info,tower_http=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Create shared server state
    let state = Arc::new(ServerState::default());

    // Define the application router with a WebSocket endpoint
    let app = Router::new().route("/", get(ws_handler)).with_state(state);

    // Run the server
    let addr = SocketAddr::from(([0, 0, 0, 0], 7777));
    info!("Leviathan (Rust) server listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app.into_make_service())
        .await
        .unwrap();
}

// WebSocket handler that upgrades the HTTP connection
async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<ServerState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

// The main logic for handling a new WebSocket connection and performing matchmaking
#[instrument(skip_all)]
async fn handle_socket(mut socket: WebSocket, state: Arc<ServerState>) {
    info!("New client connected, attempting to match...");

    let mut waiting_player_tx = state.waiting_player.lock().await;

    if let Some(opponent_tx) = waiting_player_tx.take() {
        // Match found! Send our socket to the waiting player.
        info!("Match found! Notifying waiting player.");
        match opponent_tx.send(socket) {
            Ok(_) => return, // Successfully handed off our socket
            Err(returned_socket) => {
                // The waiting player disconnected before we could match them.
                info!("Waiting player disconnected before match. Becoming the new waiting player.");
                socket = returned_socket;
            }
        }
    }

    // No opponent waiting. We become the waiting player.
    info!("Player waiting for an opponent...");
    let (new_tx, new_rx) = oneshot::channel();
    *waiting_player_tx = Some(new_tx);

    // Drop the lock so other players can connect
    drop(waiting_player_tx);

    // Wait for an opponent to connect, while also polling our socket to keep it alive
    tokio::select! {
        res = new_rx => {
            if let Ok(opponent_socket) = res {
                // We are player 1, the opponent is player 2.
                info!("Opponent found! Starting game session.");
                tokio::spawn(game_session_task(socket, opponent_socket));
            }
        }
        _ = socket.next() => {
            // This handles the case where the client disconnects while waiting.
            info!("Waiting player disconnected or sent early data. Aborting wait.");
        }
    }
}

// A task that manages the entire lifecycle of a game between two players
#[instrument(skip_all)]
async fn game_session_task(p1_socket: WebSocket, p2_socket: WebSocket) {
    info!("GameSession task started.");
    let (mut p1_sender, mut p1_receiver) = p1_socket.split();
    let (mut p2_sender, mut p2_receiver) = p2_socket.split();

    // Assign roles and notify clients
    let p1_role_msg = serde_json::to_string(&ServerMessage::RoleAssignment { role: PlayerRole::SHIPS }).unwrap() + "\n";
    let p2_role_msg = serde_json::to_string(&ServerMessage::RoleAssignment { role: PlayerRole::SUBMARINE }).unwrap() + "\n";

    if p1_sender.send(Message::Text(p1_role_msg)).await.is_err() { error!("Failed to send role to player 1"); return; }
    if p2_sender.send(Message::Text(p2_role_msg)).await.is_err() { error!("Failed to send role to player 2"); return; }
    info!("Roles assigned: Player 1 -> SHIPS, Player 2 -> SUBMARINE");

    // The authoritative state for this game session.
    let game_state = GameState {
        players: vec![
            PlayerState { id: 1, role: PlayerRole::SHIPS, angle: 0.0, hp: 100 },
            PlayerState { id: 2, role: PlayerRole::SUBMARINE, angle: 0.0, hp: 50 },
        ],
    };

    // 30 Ticks per second authoritative game loop
    let mut tick_interval = interval(Duration::from_millis(33));

    // Main game loop: process inputs, update state, and broadcast to clients.
    loop {
        tokio::select! {
            // Server Heartbeat (Tick)
            _ = tick_interval.tick() => {
                // In the future, we will update game physics (torpedo movement, etc.) here.

                // Broadcast the authoritative state to both players.
                let state_msg = ServerMessage::GameState(game_state.clone());
                let state_json = serde_json::to_string(&state_msg).unwrap() + "\n";

                let p1_ok = p1_sender.send(Message::Text(state_json.clone())).await.is_ok();
                let p2_ok = p2_sender.send(Message::Text(state_json)).await.is_ok();

                if !p1_ok || !p2_ok {
                    info!("A player disconnected during state broadcast. Ending session.");
                    // Notify the remaining player, if any.
                    if p1_ok { let _ = p1_sender.send(Message::Text(serde_json::to_string(&ServerMessage::GameOver{reason: "opponent_disconnected".to_string()}).unwrap() + "\n")).await; }
                    if p2_ok { let _ = p2_sender.send(Message::Text(serde_json::to_string(&ServerMessage::GameOver{reason: "opponent_disconnected".to_string()}).unwrap() + "\n")).await; }
                    break;
                }
            },
            // Message from player 1 (SHIPS)
            Some(Ok(msg)) = p1_receiver.next() => {
                if let Message::Close(_) = msg {
                    info!("Player 1 disconnected. Player 2 wins.");
                    let _ = p2_sender.send(Message::Text(serde_json::to_string(&ServerMessage::GameOver{reason: "opponent_disconnected".to_string()}).unwrap() + "\n")).await;
                    break;
                }
                if let Message::Text(text) = msg {
                    if let Ok(client_msg) = serde_json::from_str::<ClientMessage>(&text) {
                        info!("Received from Player 1: {:?}", client_msg);
                        // TODO: update game_state based on client_msg
                    }
                }
            },
            // Message from player 2 (SUBMARINE)
            Some(Ok(msg)) = p2_receiver.next() => {
                if let Message::Close(_) = msg {
                    info!("Player 2 disconnected. Player 1 wins.");
                    let _ = p1_sender.send(Message::Text(serde_json::to_string(&ServerMessage::GameOver{reason: "opponent_disconnected".to_string()}).unwrap() + "\n")).await;
                    break;
                }
                if let Message::Text(text) = msg {
                    if let Ok(client_msg) = serde_json::from_str::<ClientMessage>(&text) {
                        info!("Received from Player 2: {:?}", client_msg);
                        // TODO: update game_state based on client_msg
                    }
                }
            },
            else => { info!("A player disconnected or an error occurred. Ending session."); break; }
        }
    }
    info!("GameSession task finished.");
}