package main

// @title Noah Attester API
// @version 1.0
// @description Attester service for Noah ZK Identity system.
// @host localhost:8081
// @BasePath /

import (
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"os"
	"strings"
	"time"

	"noah-v2/backend/pkg/health"
	"noah-v2/backend/pkg/logger"
	"noah-v2/backend/pkg/metrics"
	"noah-v2/backend/pkg/middleware"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	_ "noah-v2/backend/attester/docs"

	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

// discoverNextAvailableID queries the contract to find the next available attester ID
// Starts from ID 1 and increments until finding an available one
func discoverNextAvailableID(config *Config) (uint, error) {
	// For development, we want a "new ID every time" and to avoid rate limits.
	// We'll pick a random ID in a very high range (1000-11000).
	// Collision probability is nearly zero in development.
	rand.Seed(time.Now().UnixNano())
	testID := uint(1000 + rand.Int31n(10000))

	// Parse contract address
	parts := strings.Split(config.AttesterRegistry, ".")
	if len(parts) != 2 {
		return testID, nil // Fallback to random ID if config is weird
	}
	contractAddress := parts[0]
	contractName := parts[1]

	apiURL := "https://api.testnet.hiro.so/v2"
	if config.StacksNetwork == "mainnet" {
		apiURL = "https://api.hiro.so/v2"
	}

	// Quick one-time check. If rate limited, just proceed with the random ID.
	idBytes := make([]byte, 8)
	binary.LittleEndian.PutUint64(idBytes, uint64(testID))
	idHex := "0x01000000000000000000000000000000" + hex.EncodeToString(idBytes)

	url := fmt.Sprintf("%s/contracts/call-read/%s/%s/get-attester-pubkey", apiURL, contractAddress, contractName)
	payload := fmt.Sprintf(`{"sender": "%s", "arguments": ["%s"]}`, contractAddress, idHex)

	resp, err := http.Post(url, "application/json", strings.NewReader(payload))
	if err != nil {
		fmt.Printf("Warning: Could not verify ID %d availability (network error). Using it anyway.\n", testID)
		return testID, nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		fmt.Printf("Warning: Could not verify ID %d availability (Status %d). Using it anyway.\n", testID, resp.StatusCode)
		return testID, nil
	}

	body, _ := io.ReadAll(resp.Body)
	bodyStr := string(body)

	// If it explicitly says okay:true and NO "none", it's taken.
	if strings.Contains(bodyStr, `"okay":true`) && !strings.Contains(bodyStr, `"result":"none"`) {
		fmt.Printf("ID %d is taken, picking another...\n", testID)
		return discoverNextAvailableID(config) // Recursive one-level retry
	}

	return testID, nil
}

func main() {
	// Load configuration
	config := LoadConfig()

	// Initialize logger
	err := logger.Initialize(logger.Config{
		Environment: os.Getenv("ENVIRONMENT"),
		Level:       os.Getenv("LOG_LEVEL"),
		Service:     "attester",
		Version:     "1.0.0",
	})
	if err != nil {
		fmt.Printf("Failed to initialize logger: %v\n", err)
		os.Exit(1)
	}
	defer logger.Sync()

	// Initialize metrics
	metrics.Initialize(metrics.Config{
		ServiceName: "attester",
	})

	// Discover next available ID dynamically (unless explicitly set via env var)
	attesterID := config.AttesterID
	if os.Getenv("ATTESTER_ID") == "" {
		// Only auto-discover if ATTESTER_ID is not explicitly set
		nextID, err := discoverNextAvailableID(config)
		if err == nil {
			attesterID = nextID
			logger.Info("Auto-discovered next available Attester ID", zap.Uint("id", attesterID))
		} else {
			logger.Warn("Could not discover next available ID, using configured ID",
				zap.Uint("id", config.AttesterID),
				zap.Error(err))
		}
	} else {
		logger.Info("Using explicitly configured Attester ID", zap.Uint("id", attesterID))
	}

	// Generate or load signer
	var signer *Signer
	var privateKeyHex string

	if config.PrivateKey == "" {
		// Generate new key pair for development
		privateKey, publicKey, err := GenerateKeyPair()
		if err != nil {
			logger.Fatal("Failed to generate key pair", zap.Error(err))
		}
		logger.Info("Generated new key pair (save private key securely)",
			zap.String("private_key", privateKey),
			zap.String("public_key", publicKey),
		)
		privateKeyHex = privateKey
	} else {
		privateKeyHex = config.PrivateKey
	}

	signer, err = NewSigner(privateKeyHex, attesterID)
	if err != nil {
		logger.Fatal("Failed to create signer", zap.Error(err))
	}

	logger.Info("Attester started",
		zap.Uint("attester_id", signer.GetAttesterID()),
		zap.String("public_key", signer.GetPublicKey()),
	)

	// Create API
	api := NewAPI(signer)

	// Setup routes
	router := gin.New() // Use gin.New() to add middleware manually

	// Add standard middleware
	router.Use(logger.GinLogger())
	router.Use(logger.GinRecovery())
	router.Use(middleware.Security())
	router.Use(metrics.HTTPMiddleware())

	// Rate limiting (100 requests per second, burst of 20)
	limiter := middleware.NewRateLimiter(100, 20)
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
		ServiceName: "attester",
		Version:     "1.0.0",
		Checks: map[string]health.Checker{
			"signer": func() health.CheckResult {
				if signer != nil {
					return health.CheckResult{Status: "healthy"}
				}
				return health.CheckResult{Status: "unhealthy", Message: "Signer not initialized"}
			},
		},
	}
	router.GET("/health", health.Handler(healthConfig))
	router.GET("/health/ready", health.ReadinessHandler())
	router.GET("/health/live", health.LivenessHandler())

	// Swagger documentation
	router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// Attester info
	router.GET("/info", api.GetAttesterInfo)
	router.GET("/info/next-available-id", api.GetNextAvailableID)

	// Metrics
	router.GET("/metrics", gin.WrapH(metrics.Handler()))

	// Credential operations
	router.POST("/credential/issue", api.IssueCredential)
	router.POST("/credential/attest", api.CreateAttestation)
	router.POST("/credential/revoke", api.RevokeCredential)
	router.POST("/passport/verify", api.VerifyPassport)

	// Revocation
	router.GET("/revocation/root", api.GetRevocationRoot)
	router.GET("/revocation/check", api.CheckRevocationStatus)

	// Start server
	logger.Info("Starting attester service", zap.String("port", config.Port))
	if err := router.Run(":" + config.Port); err != nil {
		logger.Fatal("Failed to start server", zap.Error(err))
	}
}
