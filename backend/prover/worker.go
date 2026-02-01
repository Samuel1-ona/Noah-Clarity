package main

import (
	"sync"
	"time"

	"github.com/google/uuid"
)

// JobWorker manages background proof generation
type JobWorker struct {
	circuitManager *CircuitManager
	jobs           chan *ProofJob
	results        map[string]*JobStatusResponse
	resultsMu      sync.RWMutex
}

// ProofJob represents a task for the worker
type ProofJob struct {
	ID      string
	Request *ProofRequest
}

// NewJobWorker creates a new background worker
func NewJobWorker(cm *CircuitManager) *JobWorker {
	return &JobWorker{
		circuitManager: cm,
		jobs:           make(chan *ProofJob, 100),
		results:        make(map[string]*JobStatusResponse),
	}
}

// Start begins processing jobs
func (jw *JobWorker) Start() {
	go func() {
		for job := range jw.jobs {
			jw.process(job)
		}
	}()
}

// Submit adds a job to the queue
func (jw *JobWorker) Submit(req *ProofRequest) string {
	id := uuid.New().String()

	jw.resultsMu.Lock()
	jw.results[id] = &JobStatusResponse{
		JobID:    id,
		Status:   "pending",
		IssuedAt: time.Now().Unix(),
	}
	jw.resultsMu.Unlock()

	jw.jobs <- &ProofJob{
		ID:      id,
		Request: req,
	}

	return id
}

// GetStatus retrieves the status of a job
func (jw *JobWorker) GetStatus(id string) (*JobStatusResponse, bool) {
	jw.resultsMu.RLock()
	defer jw.resultsMu.RUnlock()

	res, ok := jw.results[id]
	return res, ok
}

// process performs proof generation for a job
func (jw *JobWorker) process(job *ProofJob) {
	jw.updateStatus(job.ID, "processing", nil, "")

	response, err := jw.circuitManager.GenerateProof(job.Request)
	if err != nil {
		jw.updateStatus(job.ID, "failed", nil, err.Error())
		return
	}

	jw.updateStatus(job.ID, "completed", response, "")
}

func (jw *JobWorker) updateStatus(id, status string, result *ProofResponse, errMsg string) {
	jw.resultsMu.Lock()
	defer jw.resultsMu.Unlock()

	if res, ok := jw.results[id]; ok {
		res.Status = status
		res.Result = result
		res.Error = errMsg
	}
}
