#pragma once

#include <boost/log/trivial.hpp>
#include <boost/log/utility/setup/console.hpp>
#include <boost/log/utility/setup/common_attributes.hpp>
#include <boost/log/expressions.hpp>
#include <boost/log/support/date_time.hpp>
#include <iostream>
#include <string_view>

namespace logging = boost::log;
namespace expr = boost::log::expressions;

inline void init_logging() {
    logging::add_console_log(
        std::cout,
        logging::keywords::format = (
            expr::stream
            // Inject ANSI color codes based on severity
            << expr::if_(logging::trivial::severity == logging::trivial::info)[expr::stream << "\033[32m"]     // Green
            << expr::if_(logging::trivial::severity == logging::trivial::warning)[expr::stream << "\033[33m"]  // Yellow
            << expr::if_(logging::trivial::severity == logging::trivial::error)[expr::stream << "\033[31m"]    // Red
            << expr::if_(logging::trivial::severity == logging::trivial::debug)[expr::stream << "\033[36m"]    // Cyan
            
            // Timestamp
            << "[" << expr::format_date_time<boost::posix_time::ptime>("TimeStamp", "%Y-%m-%d %H:%M:%S") << "] "
            // Severity Level Label
            << "[" << logging::trivial::severity << "] "
            // The actual log message (includes your file/line macros)
            << expr::smessage
            // Reset console color to default
            << "\033[0m"
        ),
        logging::keywords::auto_flush = true
    );
    logging::add_common_attributes();
}

// Consteval function to strip the directory path and leave only the filename
// Evaluated strictly at compile-time, returning a lightweight string_view
consteval std::string_view extract_file_name(std::string_view path) {
    auto pos = path.find_last_of("/\\");
    return pos == std::string_view::npos ? path : path.substr(pos + 1);
}

#define LOG_DEBUG   BOOST_LOG_TRIVIAL(debug)   << "[" << extract_file_name(__FILE__) << ":" << __LINE__ << "] "
#define LOG_INFO    BOOST_LOG_TRIVIAL(info)    << "[" << extract_file_name(__FILE__) << ":" << __LINE__ << "] "
#define LOG_WARNING BOOST_LOG_TRIVIAL(warning) << "[" << extract_file_name(__FILE__) << ":" << __LINE__ << "] "
#define LOG_ERROR   BOOST_LOG_TRIVIAL(error)   << "[" << extract_file_name(__FILE__) << ":" << __LINE__ << "] "