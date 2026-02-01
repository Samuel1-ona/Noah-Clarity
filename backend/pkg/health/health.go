package health

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

var (
	startTime time.Time
)

func init() {
	startTime = time.Now()
}

// Status represents the health status
type Status struct {
	Status  string                 `json:"status"`
	Service string                 `json:"service"`
	Version string                 `json:"version"`
	Uptime  string                 `json:"uptime"`
	Checks  map[string]CheckResult `json:"checks,omitempty"`
}

// CheckResult represents a health check result
type CheckResult struct {
	Status  string `json:"status"`
	Message string `json:"message,omitempty"`
}

// Checker is a function that performs a health check
type Checker func() CheckResult

// Config holds health check configuration
type Config struct {
	ServiceName string
	Version     string
	Checks      map[string]Checker
}

// Handler returns a gin handler for health checks
func Handler(cfg Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		status := Status{
			Status:  "healthy",
			Service: cfg.ServiceName,
			Version: cfg.Version,
			Uptime:  time.Since(startTime).String(),
			Checks:  make(map[string]CheckResult),
		}

		// Run all health checks
		allHealthy := true
		for name, checker := range cfg.Checks {
			result := checker()
			status.Checks[name] = result
			if result.Status != "healthy" {
				allHealthy = false
			}
		}

		if !allHealthy {
			status.Status = "unhealthy"
			c.JSON(http.StatusServiceUnavailable, status)
			return
		}

		c.JSON(http.StatusOK, status)
	}
}

// ReadinessHandler returns a simple readiness check
func ReadinessHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status": "ready",
		})
	}
}

// LivenessHandler returns a simple liveness check
func LivenessHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status": "alive",
		})
	}
}
