# Leviathan - Game Server Architecture

## Game Concept
- **Type:** Asymmetrical naval combat game.
- **Roles:** Player 1 commands a fleet of Ships; Player 2 commands a Submarine. The Submarine and Ships have different movement and combat rules.
- **Modes:** 
  - Local PvE (Player vs Computer) - Handled entirely client-side to save cloud costs.
  - Online PvP (Player vs Player) - Handled by the Leviathan server.

## Server Tech Stack
- **Language:** C++20
- **Build System:** CMake
- **Networking:** Boost.Asio (for high-performance, asynchronous networking).
- **Serialization:** Protocol Buffers (Protobuf) or JSON to transmit grid coordinates and actions.
- **Deployment:** Docker containers hosted on GCP or AWS (with future consideration for Google Cloud Agones or AWS GameLift for scaling).

## Core Responsibilities
- **Matchmaking:** Group two connecting players into a `GameSession`.
- **Role Assignment:** Assign the `SHIPS` role to one player and the `SUBMARINE` role to the other.
- **State Synchronization / Relay:** Receive game positions and actions from one client, validate them according to the specific ruleset of that role, and transmit the result to the opponent.

