#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "Configuring the project with CMake..."
cmake -S . -B build

echo "Building the project..."
cmake --build build

echo "Stopping any previously running server..."
pkill -f LeviathanServer || true

echo "Starting the server..."
./build/bin/LeviathanServer