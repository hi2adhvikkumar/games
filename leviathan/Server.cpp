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
                            if (waiting_player_) {
                                // Matchmaking: Found two players, start a game session
                                LOG_INFO << "Match found! Starting GameSession.";
                                auto session = std::make_shared<GameSession>(std::move(waiting_player_), ws);
                                session->start();
                                waiting_player_.reset();
                            } else {
                                // Matchmaking: Wait for opponent
                                LOG_INFO << "Player waiting for an opponent...";
                                waiting_player_ = ws;
                            }
                        } else {
                            LOG_ERROR << std::format("WebSocket handshake failed: {}", ec.message());
                        }
                    });
            }
            acceptConnection();
        });
}