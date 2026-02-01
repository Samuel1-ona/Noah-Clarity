package main

import (
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

// API handles HTTP requests for attester operations
type API struct {
	issuerService     *IssuerService
	revocationService *RevocationService
	ocrService        *OCRService
	signer            *Signer
	config            *Config
}

// NewAPI creates a new API handler
func NewAPI(signer *Signer) *API {
	issuer := NewIssuerService(signer)
	return &API{
		issuerService:     issuer,
		revocationService: issuer.revocationService, // Use the same service
		ocrService:        NewOCRService(),
		signer:            signer,
		config:            LoadConfig(),
	}
}

// IssueCredential handles credential issuance requests
// @Summary Issue a new ZK credential
// @Description Extracts identity data, verifies documents, and issues a MiMC commitment signed with EdDSA and ECDSA.
// @Tags credential
// @Accept json
// @Produce json
// @Param request body CredentialRequest true "Credential Request"
// @Success 200 {object} Credential
// @Router /credential/issue [post]
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

// VerifyPassport handles passport image upload and OCR extraction
// @Summary Extract info from passport image
// @Description Uses OCR to extract document number, type, and country from an uploaded passport image.
// @Tags identity
// @Accept multipart/form-data
// @Produce json
// @Param passport formData file true "Passport image file"
// @Success 200 {object} DocumentInfo
// @Router /passport/verify [post]
func (api *API) VerifyPassport(c *gin.Context) {
	file, err := c.FormFile("passport")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Passport image is required"})
		return
	}

	// Save file temporarily
	tempPath := "temp_" + file.Filename
	if err := c.SaveUploadedFile(file, tempPath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save image"})
		return
	}
	defer os.Remove(tempPath)

	// Extract info using OCR
	docInfo, err := api.ocrService.ExtractPassportInfo(tempPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    docInfo,
	})
}

// CreateAttestation handles attestation signature requests
// @Summary Create an attestation for a ZK proof
// @Description Verifies a Groth16 proof and returns an attestation signature if valid.
// @Tags attestation
// @Accept json
// @Produce json
// @Param request body AttestationRequest true "Attestation Request"
// @Success 200 {object} AttestationResponse
// @Router /credential/attest [post]
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

// CheckRevocationStatus checks if a commitment is revoked
// GET /revocation/check?commitment=0x...
func (api *API) CheckRevocationStatus(c *gin.Context) {
	commitment := c.Query("commitment")
	if commitment == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "commitment query parameter is required",
		})
		return
	}

	isRevoked := api.revocationService.IsRevoked(commitment)
	c.JSON(http.StatusOK, gin.H{
		"commitment": commitment,
		"revoked":    isRevoked,
	})
}

// HealthCheck returns service health status
func (api *API) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "healthy",
		"service": "noah-attester",
	})
}

// GetAttesterInfo returns the attester ID and public key
func (api *API) GetAttesterInfo(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"attester_id": api.signer.GetAttesterID(),
		"public_key":  api.signer.GetPublicKey(),
	})
}

// GetNextAvailableID finds the next available attester ID by querying the contract
// Starts from the backend's configured ID and increments until finding an available one
func (api *API) GetNextAvailableID(c *gin.Context) {
	nextID, err := api.findNextAvailableID()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to find next available ID: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"next_available_id": nextID,
		"suggested_id":      nextID,
	})
}

// findNextAvailableID queries the contract to find the next available attester ID
func (api *API) findNextAvailableID() (uint, error) {
	startID := api.signer.GetAttesterID()
	maxAttempts := uint(100) // Limit search to prevent infinite loops

	// Parse contract address
	parts := strings.Split(api.config.AttesterRegistry, ".")
	if len(parts) != 2 {
		return 0, fmt.Errorf("invalid contract address format: %s", api.config.AttesterRegistry)
	}
	contractAddress := parts[0]
	contractName := parts[1]

	// Determine API URL based on network
	apiURL := "https://api.testnet.hiro.so/v2"
	if api.config.StacksNetwork == "mainnet" {
		apiURL = "https://api.hiro.so/v2"
	}

	// Try IDs starting from the configured ID
	for i := uint(0); i < maxAttempts; i++ {
		testID := startID + i

		// Encode ID as Clarity uint (little-endian, 8 bytes)
		idBytes := make([]byte, 8)
		idBytes[0] = byte(testID)
		idBytes[1] = byte(testID >> 8)
		idBytes[2] = byte(testID >> 16)
		idBytes[3] = byte(testID >> 24)
		idBytes[4] = byte(testID >> 32)
		idBytes[5] = byte(testID >> 40)
		idBytes[6] = byte(testID >> 48)
		idBytes[7] = byte(testID >> 56)
		idHex := "0x01000000000000000000000000000000" + hex.EncodeToString(idBytes)

		// Call contract read-only function
		url := fmt.Sprintf("%s/contracts/call-read/%s/%s/get-attester-pubkey", apiURL, contractAddress, contractName)
		payload := fmt.Sprintf(`{"sender": "%s", "arguments": ["%s"]}`, contractAddress, idHex)

		resp, err := http.Post(url, "application/json", strings.NewReader(payload))
		if err != nil {
			return 0, fmt.Errorf("failed to query contract: %w", err)
		}
		defer resp.Body.Close()

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return 0, fmt.Errorf("failed to read response: %w", err)
		}

		// If response contains error (attester not found), this ID is available
		bodyStr := string(body)
		if strings.Contains(bodyStr, "ERR_ATTESTER_NOT_FOUND") ||
			strings.Contains(bodyStr, "u1003") ||
			!strings.Contains(bodyStr, `"okay":true`) {
			// ID is not found, so it's available
			return testID, nil
		}
	}

	// If we've tried many IDs and all are taken, return an error
	return 0, fmt.Errorf("could not find available ID after %d attempts", maxAttempts)
}
