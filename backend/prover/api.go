package main

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

// API handles HTTP requests for proof generation
type API struct {
	circuitManager *CircuitManager
	worker         *JobWorker
}

// NewAPI creates a new API handler
func NewAPI(cm *CircuitManager, jw *JobWorker) *API {
	return &API{
		circuitManager: cm,
		worker:         jw,
	}
}

// Initialize initializes the circuit manager
func (api *API) Initialize() error {
	return api.circuitManager.Initialize()
}

// GenerateProof handles proof generation requests (Async)
func (api *API) GenerateProof(c *gin.Context) {
	var req ProofRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, JobResponse{
			Success: false,
		})
		return
	}

	// Validate request
	if err := validateProofRequest(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Submit job to worker
	jobID := api.worker.Submit(&req)

	c.JSON(http.StatusAccepted, JobResponse{
		JobID:   jobID,
		Status:  "pending",
		Success: true,
	})
}

// GetJobStatus returns the status of a proof generation job
func (api *API) GetJobStatus(c *gin.Context) {
	jobID := c.Param("id")
	status, ok := api.worker.GetStatus(jobID)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "Job not found"})
		return
	}

	c.JSON(http.StatusOK, status)
}

// HealthCheck returns service health status
func (api *API) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "healthy",
		"service": "noah-prover",
	})
}

// validateProofRequest validates the proof request
func validateProofRequest(req *ProofRequest) error {
	if req.Age.Int == nil || req.Age.Sign() < 0 {
		return fmt.Errorf("invalid age")
	}
	if req.Jurisdiction.Int == nil {
		return fmt.Errorf("invalid jurisdiction")
	}
	if req.IdentityData.Int == nil {
		return fmt.Errorf("invalid identity data")
	}
	if req.Nonce.Int == nil {
		return fmt.Errorf("invalid nonce")
	}
	if req.MinAge.Int == nil || req.MinAge.Sign() < 0 {
		return fmt.Errorf("invalid min_age")
	}
	if req.JurisdictionRoot.Int == nil {
		return fmt.Errorf("jurisdiction_root cannot be empty")
	}
	if req.UserAddress.Int == nil {
		return fmt.Errorf("user_address cannot be empty")
	}
	// Commitment can be empty (will be computed internally)
	if req.Commitment.Int == nil {
		return fmt.Errorf("invalid commitment")
	}
	return nil
}
