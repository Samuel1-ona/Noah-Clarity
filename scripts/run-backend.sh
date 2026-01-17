#!/bin/bash

# Script to run Noah-v2 backend services

echo "Starting Noah-v2 Backend Services..."
echo ""

# Check if Go is installed
if ! command -v go &> /dev/null; then
    echo "Error: Go is not installed. Please install Go 1.21+"
    exit 1
fi

# Start Prover Service
echo "Starting Prover Service on port 8080..."
cd backend/prover
go run main.go &
PROVER_PID=$!
echo "Prover Service started with PID: $PROVER_PID"
cd ../..

# Wait a moment
sleep 2

# Start Attester Service
echo "Starting Attester Service on port 8081..."
cd backend/attester
go run main.go &
ATTESTER_PID=$!
echo "Attester Service started with PID: $ATTESTER_PID"
cd ../..

echo ""
echo "Backend services are running!"
echo "Prover Service: http://localhost:8080"
echo "Attester Service: http://localhost:8081"
echo ""
echo "Press Ctrl+C to stop all services"
echo "PIDs: Prover=$PROVER_PID, Attester=$ATTESTER_PID"

# Wait for interrupt
trap "kill $PROVER_PID $ATTESTER_PID 2>/dev/null; exit" INT TERM
wait

