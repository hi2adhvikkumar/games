#include "Server.h"
#include "GameSession.h"
#include "Logger.h"
#include <memory>
#include <boost/beast/core.hpp>
#include <boost/beast/websocket.hpp>
#include <format>

namespace beast = boost::beast;
namespace websocket = beast::websocket;

Server::Server(boost::asio::io_context& io_context, short port)
    : io_context_(io_context),
      acceptor_(io_context, tcp::endpoint(tcp::v4(), port)) {
    acceptConnection();
}

void Server::registerSession(std::shared_ptr<GameSession> session) {
    std::unique_lock lock(sessions_mutex_); // Exclusive write lock
    active_sessions_.insert(session);
    LOG_INFO << std::format("GameSession registered. Active sessions: {}", active_sessions_.size());
}

void Server::unregisterSession(std::shared_ptr<GameSession> session) {
    std::unique_lock lock(sessions_mutex_); // Exclusive write lock
    active_sessions_.erase(session);
    LOG_INFO << std::format("GameSession unregistered. Active sessions: {}", active_sessions_.size());
}

void Server::broadcastToAll(const std::string& message) {
    std::shared_lock lock(sessions_mutex_); // Shared read lock allows multiple concurrent readers
    for (const auto& session : active_sessions_) {
        session->broadcast(message);
    }
}

void Server::acceptConnection() {
    acceptor_.async_accept(
        [this](const boost::system::error_code& error, tcp::socket socket) {
            if (!error) {
                LOG_INFO << "New client connected. Initiating WebSocket handshake...";
                
                auto ws = std::make_shared<websocket::stream<boost::asio::ip::tcp::socket>>(std::move(socket));
                
                ws->async_accept(
                    [this, ws](beast::error_code ec) {
                        if (!ec) {
                            LOG_INFO << "WebSocket handshake successful.";
                            
                            std::shared_ptr<GameSession> session_to_start;
                            
                            {
                                std::lock_guard lock(matchmaking_mutex_);
                                // C++23: Monadic operations for concise and functional control flow
                                std::move(waiting_player_)
                                    .transform([&](auto p1_ws) {
                                        LOG_INFO << "Match found! Preparing GameSession.";
                                        session_to_start = std::make_shared<GameSession>(std::move(p1_ws), ws);
                                        
                                        // Bind the cleanup callback to unregister upon completion
                                        session_to_start->setOnFinished([this](std::shared_ptr<GameSession> session) {
                                            unregisterSession(session);
                                        });
                                        
                                        registerSession(session_to_start);
                                        waiting_player_.reset(); // Clear the queue for the next pair
                                        return true;
                                    })
                                    .or_else([&]() -> std::optional<bool> {
                                        LOG_INFO << "Player waiting for an opponent...";
                                        waiting_player_ = ws; // Queue the player
                                        return std::nullopt;
                                    });
                            }
                            
                            // Start the session outside the lock to minimize critical section contention
                            if (session_to_start) {
                                session_to_start->start();
                            }
                        } else {
                            LOG_ERROR << std::format("WebSocket handshake failed: {}", ec.message());
                        }
                    });
            }
            acceptConnection();
        });
}