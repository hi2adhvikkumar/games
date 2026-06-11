#pragma once

#include <boost/asio.hpp>
#include <optional>

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
    std::optional<tcp::socket> waiting_player_;
};