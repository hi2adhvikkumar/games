#include "Server.h"
#include <iostream>
#include <boost/asio.hpp>

int main() {
    try {
        boost::asio::io_context io_context;
        
        Server server(io_context, 7777); 
        
        std::cout << "Leviathan Server started on port 7777\n";
        
        io_context.run();
    } catch (const std::exception& e) {
        std::cerr << "Exception: " << e.what() << "\n";
    }
    return 0;
}