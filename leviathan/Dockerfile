# Stage 1: Build the application
FROM rust:1.76 as builder

WORKDIR /usr/src/leviathan
COPY . .

# Build for release
RUN cargo install --path .

# Stage 2: Create a minimal final image
FROM debian:bullseye-slim
COPY --from=builder /usr/local/cargo/bin/leviathan /usr/local/bin/leviathan
CMD ["leviathan"]