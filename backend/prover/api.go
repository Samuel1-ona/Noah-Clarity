package main

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

// API handles HTTP requests for proof generation
type API struct {
	circuitManager *CircuitManager
}

// NewAPI creates a new API handler
func NewAPI() *API {
	return &API{
		circuitManager: NewCircuitManager(),
	}
}

// Initialize initializes the circuit manager
func (api *API) Initialize() error {
	return api.circuitManager.Initialize()
}

// GenerateProof handles proof generation requests
func (api *API) GenerateProof(c *gin.Context) {
	var req ProofRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ProofResponse{
			Success: false,
			Error:   "Invalid request: " + err.Error(),
		})
		return
	}

	// Validate request
	if err := validateProofRequest(&req); err != nil {
		c.JSON(http.StatusBadRequest, ProofResponse{
			Success: false,
			Error:   "Validation failed: " + err.Error(),
		})
		return
	}

	// Generate proof
	response, err := api.circuitManager.GenerateProof(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ProofResponse{
			Success: false,
			Error:   "Proof generation failed: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, response)
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
	if req.Age == nil || req.Age.Sign() < 0 {
		return fmt.Errorf("invalid age")
	}
	if req.Jurisdiction == nil {
		return fmt.Errorf("invalid jurisdiction")
	}
	if req.IdentityData == nil {
		return fmt.Errorf("invalid identity data")
	}
	if req.Nonce == nil {
		return fmt.Errorf("invalid nonce")
	}
	if req.MinAge == nil || req.MinAge.Sign() < 0 {
		return fmt.Errorf("invalid min_age")
	}
	if len(req.AllowedJurisdictions) == 0 {
		return fmt.Errorf("allowed_jurisdictions cannot be empty")
	}
	if req.Commitment == nil {
		return fmt.Errorf("invalid commitment")
	}
	return nil
}

