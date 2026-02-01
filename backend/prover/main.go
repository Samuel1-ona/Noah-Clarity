package main

import (
	"fmt"
	"os"

	"noah-v2/backend/pkg/health"
	"noah-v2/backend/pkg/logger"
	"noah-v2/backend/pkg/metrics"
	"noah-v2/backend/pkg/middleware"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func main() {
	// Initialize logger
	err := logger.Initialize(logger.Config{
		Environment: os.Getenv("ENVIRONMENT"),
		Level:       os.Getenv("LOG_LEVEL"),
		Service:     "prover",
		Version:     "1.0.0",
	})
	if err != nil {
		fmt.Printf("Failed to initialize logger: %v\n", err)
		os.Exit(1)
	}
	defer logger.Sync()

	// Initialize metrics
	metrics.Initialize(metrics.Config{
		ServiceName: "prover",
	})

	// Load configuration
	config := LoadConfig()

	// Create API
	api := NewAPI()

	// Initialize circuit manager
	if err := api.Initialize(); err != nil {
		logger.Fatal("Failed to initialize circuit manager", zap.Error(err))
	}
	metrics.SetCircuitInitialized(true)

	// Setup routes
	router := gin.New()

	// Add standard middleware
	router.Use(logger.GinLogger())
	router.Use(logger.GinRecovery())
	router.Use(middleware.Security())
	router.Use(metrics.HTTPMiddleware())

	// Rate limiting
	limiter := middleware.NewRateLimiter(50, 10) // Proving is expensive, lower limit
	router.Use(limiter.Middleware())

	// Configure CORS
	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173", "http://localhost:5174", "http://localhost:3000"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// Health check
	healthConfig := health.Config{
		ServiceName: "prover",
		Version:     "1.0.0",
		Checks: map[string]health.Checker{
			"circuit": func() health.CheckResult {
				// We could add more specific checks here
				return health.CheckResult{Status: "healthy"}
			},
		},
	}
	router.GET("/health", health.Handler(healthConfig))
	router.GET("/health/ready", health.ReadinessHandler())
	router.GET("/health/live", health.LivenessHandler())

	// Proof generation
	router.POST("/proof/generate", api.GenerateProof)

	// Metrics
	router.GET("/metrics", gin.WrapH(metrics.Handler()))

	// Start server
	logger.Info("Starting prover service", zap.String("port", config.Port))
	if err := router.Run(":" + config.Port); err != nil {
		logger.Fatal("Failed to start server", zap.Error(err))
	}
}
