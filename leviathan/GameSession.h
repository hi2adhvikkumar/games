#pragma once

#include <memory>
#include <string>
#include <boost/asio.hpp>
#include <boost/beast/core.hpp>
#include <boost/beast/websocket.hpp>

using boost::asio::ip::tcp;

enum class PlayerRole {
    UNASSIGNED,
    SHIPS,
    SUBMARINE
};

class GameSession : public std::enable_shared_from_this<GameSession> {
public:
    // A GameSession acts as the authoritative instance handling two matched players
    GameSession(std::shared_ptr<boost::beast::websocket::stream<boost::asio::ip::tcp::socket>> player1,
                std::shared_ptr<boost::beast::websocket::stream<boost::asio::ip::tcp::socket>> player2);

    void start();

private:
    void assignRoles();
    void startRead(int playerIndex);
    void handleRead(int playerIndex, const boost::system::error_code& error, size_t bytes_transferred);
    
    // Synchronize game positions and actions to the opponent
    void relayData(int fromPlayerIndex, const std::string& data);

    std::shared_ptr<boost::beast::websocket::stream<boost::asio::ip::tcp::socket>> player1_socket_;
    std::shared_ptr<boost::beast::websocket::stream<boost::asio::ip::tcp::socket>> player2_socket_;

    PlayerRole player1_role_ = PlayerRole::UNASSIGNED;
    PlayerRole player2_role_ = PlayerRole::UNASSIGNED;

    boost::beast::flat_buffer player1_buffer_;
    boost::beast::flat_buffer player2_buffer_;
};