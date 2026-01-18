package main

import (
	"log"

	"github.com/gin-contrib/cors"
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

	// Proof generation
	router.POST("/proof/generate", api.GenerateProof)

	// Start server
	log.Printf("Starting prover service on port %s", config.Port)
	if err := router.Run(":" + config.Port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

