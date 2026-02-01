# Build stage
FROM golang:1.24-bookworm AS builder

# Install build dependencies for gosseract (Tesseract OCR)
RUN apt-get update && apt-get install -y \
    libtesseract-dev \
    libleptonica-dev \
    tesseract-ocr-eng \
    pkg-config \
    g++

WORKDIR /app

# Copy the whole project for relative module resolution
COPY . .

WORKDIR /app/backend/attester
RUN go mod download
RUN go build -o /app/attester-service .

# Production stage
FROM debian:bookworm-slim

# Install runtime dependencies for OCR
RUN apt-get update && apt-get install -y \
    libtesseract4 \
    tesseract-ocr-eng \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/attester-service .
# The app will look for kyc_verifying.key in the path specified by config or env
# We can provide a default one or mount it via volumes

EXPOSE 8081

CMD ["./attester-service"]
