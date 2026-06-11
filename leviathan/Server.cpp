#include "Server.h"
#include "GameSession.h"
#include <iostream>

Server::Server(boost::asio::io_context& io_context, short port)
    : io_context_(io_context),
      acceptor_(io_context, tcp::endpoint(tcp::v4(), port)) {
    acceptConnection();
}

void Server::acceptConnection() {
    acceptor_.async_accept(
        [this](const boost::system::error_code& error, tcp::socket socket) {
            if (!error) {
                std::cout << "New client connected.\n";
                if (waiting_player_.has_value()) {
                    // Matchmaking: Found two players, start a game session
                    std::cout << "Match found! Starting GameSession.\n";
                    auto session = std::make_shared<GameSession>(std::move(*waiting_player_), std::move(socket));
                    session->start();
                    waiting_player_.reset();
                } else {
                    // Matchmaking: Wait for opponent
                    std::cout << "Player waiting for an opponent...\n";
                    waiting_player_ = std::move(socket);
                }
            }
            acceptConnection();
        });
}