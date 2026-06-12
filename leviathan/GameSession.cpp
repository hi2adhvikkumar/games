#include "GameSession.h"
#include "Logger.h"
#include <string>
#include <memory>
#include <boost/asio/buffer.hpp>
#include <boost/beast/core.hpp>
#include <boost/beast/core/buffers_to_string.hpp>
#include <boost/beast/websocket.hpp>
#include <format>
#include <utility>

namespace beast = boost::beast;

GameSession::GameSession(std::shared_ptr<boost::beast::websocket::stream<boost::asio::ip::tcp::socket>> player1, std::shared_ptr<boost::beast::websocket::stream<boost::asio::ip::tcp::socket>> player2)
    : player1_socket_(std::move(player1)), player2_socket_(std::move(player2)) {
}

void GameSession::setOnFinished(std::function<void(std::shared_ptr<GameSession>)> on_finished) {
    on_finished_ = std::move(on_finished);
}

void GameSession::broadcast(const std::string& message) {
    auto msg = std::make_shared<std::string>(message);
    auto self = shared_from_this();
    
    // Safely dispatch asynchronous writes into the respective stream's executor context
    boost::asio::dispatch(player1_socket_->get_executor(), [this, self, msg]() {
        if (player1_socket_->is_open()) {
            player1_socket_->async_write(boost::asio::buffer(*msg), [self, msg = std::move(msg)](const boost::system::error_code&, std::size_t){});
        }
    });
    
    boost::asio::dispatch(player2_socket_->get_executor(), [this, self, msg]() {
        if (player2_socket_->is_open()) {
            player2_socket_->async_write(boost::asio::buffer(*msg), [self, msg = std::move(msg)](const boost::system::error_code&, std::size_t){});
        }
    });
}

void GameSession::start() {
    assignRoles();
    startRead(1);
    startRead(2);
}

void GameSession::assignRoles() {
    using enum PlayerRole; // C++20: Brings enum values into scope

    // Assymetrical Role Assignment
    player1_role_ = SHIPS;
    player2_role_ = SUBMARINE;
    
    // C++23: std::to_underlying safely casts strongly-typed enums to integers
    LOG_INFO << std::format("Roles assigned: Player 1 -> SHIPS (Role ID: {}), Player 2 -> SUBMARINE (Role ID: {})", 
                             std::to_underlying(player1_role_), 
                             std::to_underlying(player2_role_));

    // Transmit assignment JSON/Protobuf packets to clients to lock in their UI
    auto p1_msg = std::make_shared<std::string>("{\"type\":\"role_assignment\",\"role\":\"SHIPS\"}\n");
    auto p2_msg = std::make_shared<std::string>("{\"type\":\"role_assignment\",\"role\":\"SUBMARINE\"}\n");

    auto self = shared_from_this();
    player1_socket_->text(true);
    player2_socket_->text(true);

    auto p1_buf = boost::asio::buffer(*p1_msg);
    player1_socket_->async_write(p1_buf, [self, p1_msg = std::move(p1_msg)](const boost::system::error_code&, std::size_t){});
    
    auto p2_buf = boost::asio::buffer(*p2_msg);
    player2_socket_->async_write(p2_buf, [self, p2_msg = std::move(p2_msg)](const boost::system::error_code&, std::size_t){});
}

void GameSession::startRead(int playerIndex) {
    auto self = shared_from_this();
    
    auto [ws, buffer] = [&]() {
        if (playerIndex == 1) return std::pair{player1_socket_, &player1_buffer_};
        if (playerIndex == 2) return std::pair{player2_socket_, &player2_buffer_};
        std::unreachable(); // C++23: Tells the compiler to omit branch bounds checking
    }();

    // Reading complete WebSocket message frame
    ws->async_read(*buffer,
        [this, self, playerIndex, ws, buffer](const beast::error_code& error, size_t bytes_transferred) {
            handleRead(playerIndex, error, bytes_transferred);
        });
}

void GameSession::handleRead(int playerIndex, const boost::system::error_code& error, size_t /*bytes_transferred*/) {
    if (!error) {
        auto buffer = [&]() {
            if (playerIndex == 1) return &player1_buffer_;
            if (playerIndex == 2) return &player2_buffer_;
            std::unreachable(); // C++23
        }();
        
        std::string data = beast::buffers_to_string(buffer->data());
        buffer->consume(buffer->size());

        // C++23: std::string::contains() is vastly superior to str.find() != string::npos
        if (data.contains("\"action\":\"shoot\"")) {
            LOG_INFO << std::format("Player {} fired a weapon!", playerIndex);
        }

        // Validate against the specific ruleset of that role here before relaying
        relayData(playerIndex, data);
        startRead(playerIndex);
    } else {
        LOG_ERROR << std::format("Player {} disconnected: {}", playerIndex, error.message());
        
        auto victory_msg = std::make_shared<std::string>("{\"type\":\"game_over\",\"reason\":\"opponent_disconnected\",\"winner\":true}\n");
        auto self = shared_from_this();
        auto remaining_ws = [&]() {
            if (playerIndex == 1) return player2_socket_;
            if (playerIndex == 2) return player1_socket_;
            std::unreachable(); // C++23
        }();
        
        if (remaining_ws->is_open()) {
            remaining_ws->async_write(boost::asio::buffer(*victory_msg), [self, victory_msg](const boost::system::error_code&, std::size_t){});
        }
        
        // Atomically guarantee cleanup is only called once per session
        if (!is_finished_.exchange(true) && on_finished_) {
            on_finished_(self);
        }
    }
}

void GameSession::relayData(int fromPlayerIndex, const std::string& data) {
    auto self = shared_from_this();
    auto target_ws = [&]() {
        if (fromPlayerIndex == 1) return player2_socket_;
        if (fromPlayerIndex == 2) return player1_socket_;
        std::unreachable(); // C++23
    }();

    auto msg = std::make_shared<std::string>(data);
    auto buf = boost::asio::buffer(*msg);
    // Fire-and-forget relaying mechanism via Beast async write
    target_ws->async_write(buf,
        [self, msg = std::move(msg)](const boost::system::error_code& /*error*/, size_t /*bytes_transferred*/) {});
}