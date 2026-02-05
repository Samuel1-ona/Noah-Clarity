#!/bin/bash

# Configuration to bypass API rate limits
# Using ID 105 (likely available) and a stable private key
export ATTESTER_ID=105
export ATTESTER_PRIVATE_KEY=bdd7e2527a9fc8e6c3de0f3d2a8afd7a58c65b03c2589574e699c239a6d74f3a

echo "Starting Attester with Manual ID $ATTESTER_ID..."
echo "Public Key: 034484e076451639404b93ed25f4e50eb84fd63038d5e40edc8f8545cf74a0c6f3"
echo "---------------------------------------------------"

go run .
