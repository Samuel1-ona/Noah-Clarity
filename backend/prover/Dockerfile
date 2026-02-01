# Build stage
FROM golang:1.24-bookworm AS builder

WORKDIR /app

# Copy the whole project for relative module resolution
COPY . .

WORKDIR /app/backend/prover
RUN go mod download
RUN go build -o /app/prover-service .

# Production stage
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/prover-service .

EXPOSE 8080

CMD ["./prover-service"]
