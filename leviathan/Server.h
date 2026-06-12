#pragma once

#include <boost/asio.hpp>
#include <memory>
#include <optional>
#include <mutex>
#include <shared_mutex>
#include <unordered_set>
#include <boost/beast/core.hpp>
#include <boost/beast/websocket.hpp>

using boost::asio::ip::tcp;

class GameSession;

class Server {
public:
    Server(boost::asio::io_context& io_context, short port);

    // Server-wide broadcasting to all active sessions
    void broadcastToAll(const std::string& message);

private:
    void acceptConnection();
    void registerSession(std::shared_ptr<GameSession> session);
    void unregisterSession(std::shared_ptr<GameSession> session);

    boost::asio::io_context& io_context_;
    tcp::acceptor acceptor_;
    
    // Thread-safe registry for active game sessions
    std::unordered_set<std::shared_ptr<GameSession>> active_sessions_;
    std::shared_mutex sessions_mutex_;

    // Matchmaking queue - stores the socket of the first player waiting for an opponent.
    // Once a second player connects, they are grouped into a GameSession.
    std::optional<std::shared_ptr<boost::beast::websocket::stream<boost::asio::ip::tcp::socket>>> waiting_player_;
    std::mutex matchmaking_mutex_;
};