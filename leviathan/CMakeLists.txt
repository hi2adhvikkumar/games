cmake_minimum_required(VERSION 3.20)
project(LeviathanServer VERSION 1.0)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Output executable to a clean 'bin' directory inside the build folder
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)

find_package(Boost REQUIRED COMPONENTS system)

add_executable(LeviathanServer
    main.cpp
    Server.cpp
    GameSession.cpp
)

target_include_directories(LeviathanServer PRIVATE ${Boost_INCLUDE_DIRS} .)
target_link_libraries(LeviathanServer PRIVATE ${Boost_LIBRARIES} pthread)