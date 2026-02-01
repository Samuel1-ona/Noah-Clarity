package main

// @title Noah Prover API
// @version 1.0
// @description Prover service for Noah ZK Identity system. Handles asynchronous ZK proof generation.
// @host localhost:8080
// @BasePath /

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

	_ "noah-v2/backend/prover/docs"

	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
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

	// Initialize circuit manager
	cm := NewCircuitManager()
	if err := cm.Initialize(); err != nil {
		logger.Fatal("Failed to initialize circuit manager", zap.Error(err))
	}
	metrics.SetCircuitInitialized(true)

	// Initialize worker
	worker := NewJobWorker(cm)
	worker.Start()
	logger.Info("Background job worker started")

	// Create API
	api := NewAPI(cm, worker)

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

	// Swagger documentation
	router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// Proof generation
	router.POST("/proof/generate", api.GenerateProof)
	router.GET("/proof/status/:id", api.GetJobStatus)

	// Metrics
	router.GET("/metrics", gin.WrapH(metrics.Handler()))

	// Start server
	logger.Info("Starting prover service", zap.String("port", config.Port))
	if err := router.Run(":" + config.Port); err != nil {
		logger.Fatal("Failed to start server", zap.Error(err))
	}
}
