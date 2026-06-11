#include "GameSession.h"
#include <iostream>
#include <string>
#include <memory>
#include <boost/asio/buffer.hpp>
#include <boost/beast/core.hpp>
#include <boost/beast/core/buffers_to_string.hpp>
#include <boost/beast/websocket.hpp>

namespace beast = boost::beast;

GameSession::GameSession(std::shared_ptr<boost::beast::websocket::stream<boost::asio::ip::tcp::socket>> player1, std::shared_ptr<boost::beast::websocket::stream<boost::asio::ip::tcp::socket>> player2)
    : player1_socket_(player1), player2_socket_(player2) {
}

void GameSession::start() {
    assignRoles();
    startRead(1);
    startRead(2);
}

void GameSession::assignRoles() {
    // Assymetrical Role Assignment
    player1_role_ = PlayerRole::SHIPS;
    player2_role_ = PlayerRole::SUBMARINE;
    std::cout << "Roles assigned: Player 1 -> SHIPS, Player 2 -> SUBMARINE\n";

    // Transmit assignment JSON/Protobuf packets to clients to lock in their UI
    auto p1_msg = std::make_shared<std::string>("{\"type\":\"role_assignment\",\"role\":\"SHIPS\"}\n");
    auto p2_msg = std::make_shared<std::string>("{\"type\":\"role_assignment\",\"role\":\"SUBMARINE\"}\n");

    auto self = shared_from_this();
    player1_socket_->text(true);
    player2_socket_->text(true);

    player1_socket_->async_write(boost::asio::buffer(*p1_msg), [self, p1_msg](const boost::system::error_code&, std::size_t){});
    player2_socket_->async_write(boost::asio::buffer(*p2_msg), [self, p2_msg](const boost::system::error_code&, std::size_t){});
}

void GameSession::startRead(int playerIndex) {
    auto self = shared_from_this();
    auto ws = (playerIndex == 1) ? player1_socket_ : player2_socket_;
    auto buffer = (playerIndex == 1) ? &player1_buffer_ : &player2_buffer_;

    // Reading complete WebSocket message frame
    ws->async_read(*buffer,
        [this, self, playerIndex, ws, buffer](const beast::error_code& error, size_t bytes_transferred) {
            handleRead(playerIndex, error, bytes_transferred);
        });
}

void GameSession::handleRead(int playerIndex, const boost::system::error_code& error, size_t /*bytes_transferred*/) {
    if (!error) {
        auto buffer = (playerIndex == 1) ? &player1_buffer_ : &player2_buffer_;
        
        std::string data = beast::buffers_to_string(buffer->data());
        buffer->consume(buffer->size());

        // Validate against the specific ruleset of that role here before relaying
        relayData(playerIndex, data);
        startRead(playerIndex);
    } else {
        std::cerr << "Player " << playerIndex << " disconnected: " << error.message() << "\n";
        
        auto victory_msg = std::make_shared<std::string>("{\"type\":\"game_over\",\"reason\":\"opponent_disconnected\",\"winner\":true}\n");
        auto self = shared_from_this();
        auto remaining_ws = (playerIndex == 1) ? player2_socket_ : player1_socket_;
        
        if (remaining_ws->is_open()) {
            remaining_ws->async_write(boost::asio::buffer(*victory_msg), [self, victory_msg](const boost::system::error_code&, std::size_t){});
        }
    }
}

void GameSession::relayData(int fromPlayerIndex, const std::string& data) {
    auto self = shared_from_this();
    auto target_ws = (fromPlayerIndex == 1) ? player2_socket_ : player1_socket_;

    auto msg = std::make_shared<std::string>(data);
    // Fire-and-forget relaying mechanism via Beast async write
    target_ws->async_write(boost::asio::buffer(*msg),
        [self, msg](const boost::system::error_code& /*error*/, size_t /*bytes_transferred*/) {});
}