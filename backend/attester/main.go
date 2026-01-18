package main

import (
	"log"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	// Load configuration
	config := LoadConfig()

	// Generate or load signer
	var signer *Signer
	var err error

	if config.PrivateKey == "" {
		// Generate new key pair for development
		privateKey, publicKey, err := GenerateKeyPair()
		if err != nil {
			log.Fatalf("Failed to generate key pair: %v", err)
		}
		log.Printf("Generated new key pair (save private key securely):")
		log.Printf("Private Key: %s", privateKey)
		log.Printf("Public Key: %s", publicKey)

		signer, err = NewSigner(privateKey, config.AttesterID)
		if err != nil {
			log.Fatalf("Failed to create signer: %v", err)
		}
	} else {
		signer, err = NewSigner(config.PrivateKey, config.AttesterID)
		if err != nil {
			log.Fatalf("Failed to create signer: %v", err)
		}
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

