#pragma once

#include <boost/asio.hpp>
#include <memory>
#include <boost/beast/core.hpp>
#include <boost/beast/websocket.hpp>

using boost::asio::ip::tcp;

class Server {
public:
    Server(boost::asio::io_context& io_context, short port);

private:
    void acceptConnection();

    boost::asio::io_context& io_context_;
    tcp::acceptor acceptor_;
    
    // Matchmaking queue - stores the socket of the first player waiting for an opponent.
    // Once a second player connects, they are grouped into a GameSession.
    std::shared_ptr<boost::beast::websocket::stream<boost::asio::ip::tcp::socket>> waiting_player_;
};