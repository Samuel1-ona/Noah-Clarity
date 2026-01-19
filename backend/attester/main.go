package main

import (
	"encoding/hex"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// discoverNextAvailableID queries the contract to find the next available attester ID
// Starts from ID 1 and increments until finding an available one
func discoverNextAvailableID(config *Config) (uint, error) {
	startID := uint(1)
	maxAttempts := uint(100) // Limit search to prevent infinite loops

	// Parse contract address
	parts := strings.Split(config.AttesterRegistry, ".")
	if len(parts) != 2 {
		return 0, fmt.Errorf("invalid contract address format: %s", config.AttesterRegistry)
	}
	contractAddress := parts[0]
	contractName := parts[1]

	// Determine API URL based on network
	apiURL := "https://api.testnet.hiro.so/v2"
	if config.StacksNetwork == "mainnet" {
		apiURL = "https://api.hiro.so/v2"
	}

	// Try IDs starting from 1
	for i := uint(0); i < maxAttempts; i++ {
		testID := startID + i
		
		// Encode ID as Clarity uint (little-endian, 8 bytes)
		idBytes := make([]byte, 8)
		idBytes[0] = byte(testID)
		idBytes[1] = byte(testID >> 8)
		idBytes[2] = byte(testID >> 16)
		idBytes[3] = byte(testID >> 24)
		idBytes[4] = byte(testID >> 32)
		idBytes[5] = byte(testID >> 40)
		idBytes[6] = byte(testID >> 48)
		idBytes[7] = byte(testID >> 56)
		idHex := "0x01000000000000000000000000000000" + hex.EncodeToString(idBytes)

		// Call contract read-only function
		url := fmt.Sprintf("%s/contracts/call-read/%s/%s/get-attester-pubkey", apiURL, contractAddress, contractName)
		payload := fmt.Sprintf(`{"sender": "%s", "arguments": ["%s"]}`, contractAddress, idHex)

		resp, err := http.Post(url, "application/json", strings.NewReader(payload))
		if err != nil {
			return 0, fmt.Errorf("failed to query contract: %w", err)
		}
		defer resp.Body.Close()

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return 0, fmt.Errorf("failed to read response: %w", err)
		}

		// If response contains error (attester not found), this ID is available
		bodyStr := string(body)
		if strings.Contains(bodyStr, "ERR_ATTESTER_NOT_FOUND") || 
		   strings.Contains(bodyStr, "u1003") ||
		   !strings.Contains(bodyStr, `"okay":true`) {
			// ID is not found, so it's available
			return testID, nil
		}
	}

	// If we've tried many IDs and all are taken, return an error
	return 0, fmt.Errorf("could not find available ID after %d attempts", maxAttempts)
}

func main() {
	// Load configuration
	config := LoadConfig()

	// Discover next available ID dynamically (unless explicitly set via env var)
	attesterID := config.AttesterID
	if os.Getenv("ATTESTER_ID") == "" {
		// Only auto-discover if ATTESTER_ID is not explicitly set
		nextID, err := discoverNextAvailableID(config)
		if err == nil {
			attesterID = nextID
			log.Printf("Auto-discovered next available Attester ID: %d", attesterID)
		} else {
			log.Printf("Could not discover next available ID, using configured ID %d: %v", config.AttesterID, err)
		}
	} else {
		log.Printf("Using explicitly configured Attester ID: %d", attesterID)
	}

	// Generate or load signer
	var signer *Signer
	var err error
	var privateKeyHex string

	if config.PrivateKey == "" {
		// Generate new key pair for development
		privateKey, publicKey, err := GenerateKeyPair()
		if err != nil {
			log.Fatalf("Failed to generate key pair: %v", err)
		}
		log.Printf("Generated new key pair (save private key securely):")
		log.Printf("Private Key: %s", privateKey)
		log.Printf("Public Key: %s", publicKey)
		privateKeyHex = privateKey
	} else {
		privateKeyHex = config.PrivateKey
	}

	signer, err = NewSigner(privateKeyHex, attesterID)
		if err != nil {
			log.Fatalf("Failed to create signer: %v", err)
	}

	log.Printf("Attester ID: %d", signer.GetAttesterID())
	log.Printf("Public Key: %s", signer.GetPublicKey())

	// Create API
	api := NewAPI(signer)

	// Setup routes
	router := gin.Default()

	// Configure CORS
	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173", "http://localhost:5174", "http://localhost:3000"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// Health check
	router.GET("/health", api.HealthCheck)

	// Attester info
	router.GET("/info", api.GetAttesterInfo)
	router.GET("/info/next-available-id", api.GetNextAvailableID)

	// Credential operations
	router.POST("/credential/issue", api.IssueCredential)
	router.POST("/credential/attest", api.CreateAttestation)
	router.POST("/credential/revoke", api.RevokeCredential)

	// Revocation
	router.GET("/revocation/root", api.GetRevocationRoot)

	// Start server
	log.Printf("Starting attester service on port %s", config.Port)
	if err := router.Run(":" + config.Port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

