.PHONY: build test clean run-prover run-attester

# Build all Go services
build:
	cd circuit && go build ./...
	cd backend/prover && go build
	cd backend/attester && go build

# Run tests
test:
	cd circuit && go test ./...
	cd backend/prover && go test ./...
	cd backend/attester && go test ./...

# Clean build artifacts
clean:
	rm -rf circuit/*.test
	rm -rf backend/prover/*.test
	rm -rf backend/attester/*.test
	rm -rf frontend/build
	rm -rf packages/noah-sdk/dist

# Run proof service
run-prover:
	cd backend/prover && go run main.go

# Run attester service
run-attester:
	cd backend/attester && go run main.go

# Install all dependencies
install:
	cd circuit && go mod download
	cd backend/prover && go mod download
	cd backend/attester && go mod download
	cd frontend && npm install
	cd packages/noah-sdk && npm install

# Build frontend
build-frontend:
	cd frontend && npm run build

# Build SDK
build-sdk:
	cd packages/noah-sdk && npm run build

