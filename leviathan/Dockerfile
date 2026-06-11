FROM ubuntu:22.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install C++ compiler, CMake, Boost.Asio dependencies, and Protobuf
RUN apt-get update && apt-get install -y \
    build-essential \
    g++ \
    cmake \
    libboost-system-dev \
    protobuf-compiler \
    libprotobuf-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app