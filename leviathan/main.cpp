#include "Server.h"
#include "Logger.h"
#include <boost/asio.hpp>
#include <format>
#include <csignal>
#include <stacktrace>

void crash_handler(int signum) {
    LOG_ERROR << std::format("CRITICAL CRASH DETECTED! Signal: {}", signum);
    LOG_ERROR << "Stacktrace:\n" << std::stacktrace::current();
    std::exit(signum);
}

int main() {
    init_logging();
    
    // Register POSIX signal handlers for fatal crashes
    std::signal(SIGSEGV, crash_handler); // Segmentation fault
    std::signal(SIGABRT, crash_handler); // Abort
    std::signal(SIGILL,  crash_handler); // Illegal instruction
    std::signal(SIGFPE,  crash_handler); // Floating point exception

    try {
        boost::asio::io_context io_context;
        
        Server server(io_context, 7777); 
        
        LOG_INFO << std::format("Leviathan Server started on port {}", 7777);
        
        io_context.run();
    } catch (const std::exception& e) {
        LOG_ERROR << std::format("Exception: {}", e.what());
        LOG_ERROR << "Stacktrace:\n" << std::stacktrace::current();
    }
    return 0;
}