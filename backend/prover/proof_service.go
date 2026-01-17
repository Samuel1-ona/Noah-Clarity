package main

// ProofService provides high-level proof generation functionality
type ProofService struct {
	circuitManager *CircuitManager
}

// NewProofService creates a new proof service
func NewProofService() *ProofService {
	return &ProofService{
		circuitManager: NewCircuitManager(),
	}
}

// Initialize initializes the proof service
func (ps *ProofService) Initialize() error {
	return ps.circuitManager.Initialize()
}

// GenerateProof generates a proof for the given request
func (ps *ProofService) GenerateProof(req *ProofRequest) (*ProofResponse, error) {
	return ps.circuitManager.GenerateProof(req)
}

