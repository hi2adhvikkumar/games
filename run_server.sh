#!/bin/bash

echo "Building and running the Leviathan server..."
cd "$(dirname "$0")/leviathan" || exit 1
cargo run