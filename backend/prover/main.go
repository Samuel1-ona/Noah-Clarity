package main

import (
	"log"

	"github.com/gin-gonic/gin"
)

func main() {
	// Load configuration
	config := LoadConfig()

	// Create API
	api := NewAPI()

	// Initialize circuit manager
	if err := api.Initialize(); err != nil {
		log.Fatalf("Failed to initialize circuit manager: %v", err)
	}

	// Setup routes
	router := gin.Default()

	// Health check
	router.GET("/health", api.HealthCheck)

	// Proof generation
	router.POST("/proof/generate", api.GenerateProof)

	// Start server
	log.Printf("Starting prover service on port %s", config.Port)
	if err := router.Run(":" + config.Port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

