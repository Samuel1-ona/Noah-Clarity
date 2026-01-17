package main

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// API handles HTTP requests for attester operations
type API struct {
	issuerService     *IssuerService
	revocationService *RevocationService
}

// NewAPI creates a new API handler
func NewAPI(signer *Signer) *API {
	return &API{
		issuerService:     NewIssuerService(signer),
		revocationService: NewRevocationService(),
	}
}

// IssueCredential handles credential issuance requests
func (api *API) IssueCredential(c *gin.Context) {
	var req CredentialRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request: " + err.Error(),
		})
		return
	}

	credential, err := api.issuerService.IssueCredential(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"credential": credential,
	})
}

// CreateAttestation handles attestation signature requests
func (api *API) CreateAttestation(c *gin.Context) {
	var req AttestationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, AttestationResponse{
			Success: false,
			Error:   "Invalid request: " + err.Error(),
		})
		return
	}

	response, err := api.issuerService.CreateAttestation(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, AttestationResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, response)
}

// RevokeCredential handles credential revocation requests
func (api *API) RevokeCredential(c *gin.Context) {
	var req RevocationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request: " + err.Error(),
		})
		return
	}

	if err := api.revocationService.RevokeCredential(req.Commitment); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Credential revoked",
		"root":    api.revocationService.GetRevocationRoot(),
	})
}

// GetRevocationRoot returns the current revocation Merkle root
func (api *API) GetRevocationRoot(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"root":  api.revocationService.GetRevocationRoot(),
		"count": api.revocationService.GetRevokedCount(),
	})
}

// HealthCheck returns service health status
func (api *API) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "healthy",
		"service": "noah-attester",
	})
}

