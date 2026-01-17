package main

import (
	"log"

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

	// Health check
	router.GET("/health", api.HealthCheck)

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

