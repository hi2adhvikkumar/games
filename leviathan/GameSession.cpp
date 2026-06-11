#include "GameSession.h"
#include <iostream>

GameSession::GameSession(tcp::socket player1, tcp::socket player2)
    : player1_socket_(std::move(player1)), player2_socket_(std::move(player2)) {
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

    // TODO: Transmit assignment JSON/Protobuf packets to clients to lock in their UI
}

void GameSession::startRead(int playerIndex) {
    auto self = shared_from_this();
    auto& socket = (playerIndex == 1) ? player1_socket_ : player2_socket_;
    auto& buffer = (playerIndex == 1) ? player1_buffer_ : player2_buffer_;

    // Reading delimited stream assuming newline separates JSON/protobuf payloads
    boost::asio::async_read_until(socket, buffer, '\n',
        [this, self, playerIndex](const boost::system::error_code& error, size_t bytes_transferred) {
            handleRead(playerIndex, error, bytes_transferred);
        });
}

void GameSession::handleRead(int playerIndex, const boost::system::error_code& error, size_t bytes_transferred) {
    if (!error) {
        auto& buffer = (playerIndex == 1) ? player1_buffer_ : player2_buffer_;
        std::istream is(&buffer);
        std::string data;
        std::getline(is, data);

        // Validate against the specific ruleset of that role here before relaying
        relayData(playerIndex, data + "\n");
        startRead(playerIndex);
    } else {
        std::cerr << "Player " << playerIndex << " disconnected: " << error.message() << "\n";
        // TODO: Handle disconnect and declare the remaining player victorious
    }
}

void GameSession::relayData(int fromPlayerIndex, const std::string& data) {
    auto self = shared_from_this();
    auto& target_socket = (fromPlayerIndex == 1) ? player2_socket_ : player1_socket_;

    // Fire-and-forget relaying mechanism via Asio async writes
    boost::asio::async_write(target_socket, boost::asio::buffer(data),
        [self](const boost::system::error_code& /*error*/, size_t /*bytes_transferred*/) {});
}