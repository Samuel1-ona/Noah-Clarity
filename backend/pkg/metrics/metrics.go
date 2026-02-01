package metrics

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	// HTTP metrics
	httpRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total number of HTTP requests",
		},
		[]string{"service", "method", "path", "status"},
	)

	httpRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "HTTP request latency in seconds",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"service", "method", "path", "status"},
	)

	httpRequestsInFlight = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "http_requests_in_flight",
			Help: "Current number of HTTP requests being processed",
		},
		[]string{"service"},
	)

	// Proof generation metrics
	proofGenerationTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "proof_generation_total",
			Help: "Total number of proof generation attempts",
		},
		[]string{"service", "status"},
	)

	proofGenerationDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "proof_generation_duration_seconds",
			Help:    "Proof generation duration in seconds",
			Buckets: []float64{0.1, 0.5, 1, 2, 5, 10, 30, 60},
		},
		[]string{"service"},
	)

	// Proof verification metrics
	proofVerificationTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "proof_verification_total",
			Help: "Total number of proof verification attempts",
		},
		[]string{"service", "status"},
	)

	proofVerificationDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "proof_verification_duration_seconds",
			Help:    "Proof verification duration in seconds",
			Buckets: []float64{0.01, 0.05, 0.1, 0.5, 1, 2},
		},
		[]string{"service"},
	)

	// Circuit metrics
	circuitInitialized = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "circuit_initialized",
			Help: "Whether the circuit is initialized (1) or not (0)",
		},
		[]string{"service"},
	)
)

// Config holds metrics configuration
type Config struct {
	ServiceName string
}

var config Config

// Initialize sets up metrics with service name
func Initialize(cfg Config) {
	config = cfg
}

// HTTPMiddleware returns a gin middleware for collecting HTTP metrics
func HTTPMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		// Increment in-flight requests
		httpRequestsInFlight.WithLabelValues(config.ServiceName).Inc()
		defer httpRequestsInFlight.WithLabelValues(config.ServiceName).Dec()

		// Process request
		c.Next()

		// Record metrics
		duration := time.Since(start).Seconds()
		status := c.Writer.Status()
		method := c.Request.Method
		path := c.FullPath()
		if path == "" {
			path = c.Request.URL.Path
		}

		httpRequestsTotal.WithLabelValues(
			config.ServiceName,
			method,
			path,
			http.StatusText(status),
		).Inc()

		httpRequestDuration.WithLabelValues(
			config.ServiceName,
			method,
			path,
			http.StatusText(status),
		).Observe(duration)
	}
}

// RecordProofGeneration records proof generation metrics
func RecordProofGeneration(duration time.Duration, success bool) {
	status := "success"
	if !success {
		status = "failure"
	}

	proofGenerationTotal.WithLabelValues(config.ServiceName, status).Inc()
	proofGenerationDuration.WithLabelValues(config.ServiceName).Observe(duration.Seconds())
}

// RecordProofVerification records proof verification metrics
func RecordProofVerification(duration time.Duration, success bool) {
	status := "success"
	if !success {
		status = "failure"
	}

	proofVerificationTotal.WithLabelValues(config.ServiceName, status).Inc()
	proofVerificationDuration.WithLabelValues(config.ServiceName).Observe(duration.Seconds())
}

// SetCircuitInitialized sets the circuit initialization status
func SetCircuitInitialized(initialized bool) {
	value := 0.0
	if initialized {
		value = 1.0
	}
	circuitInitialized.WithLabelValues(config.ServiceName).Set(value)
}

// Handler returns the prometheus HTTP handler
func Handler() http.Handler {
	return promhttp.Handler()
}
