#include "Server.h"
#include "Logger.h"
#include <boost/asio.hpp>
#include <format>

int main() {
    init_logging();
    try {
        boost::asio::io_context io_context;
        
        Server server(io_context, 7777); 
        
        LOG_INFO << std::format("Leviathan Server started on port {}", 7777);
        
        io_context.run();
    } catch (const std::exception& e) {
        LOG_ERROR << std::format("Exception: {}", e.what());
    }
    return 0;
}