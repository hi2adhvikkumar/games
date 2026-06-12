cmake_minimum_required(VERSION 3.25)
project(LeviathanServer VERSION 1.0)

set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Enable debug symbols so std::stacktrace prints line numbers and function names
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -g")

# Generate compile_commands.json for clangd IntelliSense
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# Output executable to a clean 'bin' directory inside the build folder
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)

find_package(Boost REQUIRED COMPONENTS system log log_setup thread)

add_executable(LeviathanServer
    main.cpp
    Server.cpp
    GameSession.cpp
)

target_include_directories(LeviathanServer PRIVATE ${Boost_INCLUDE_DIRS} .)
target_link_libraries(LeviathanServer PRIVATE ${Boost_LIBRARIES} pthread)