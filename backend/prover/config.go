package main

import (
	"os"
)

// Config holds the prover service configuration
type Config struct {
	Port            string
	CircuitPath     string
	ProvingKeyPath  string
	VerifyingKeyPath string
}

// LoadConfig loads configuration from environment variables
func LoadConfig() *Config {
	return &Config{
		Port:            getEnv("PROVER_PORT", "8080"),
		CircuitPath:     getEnv("CIRCUIT_PATH", "./circuit"),
		ProvingKeyPath:  getEnv("PROVING_KEY_PATH", "./keys/proving.key"),
		VerifyingKeyPath: getEnv("VERIFYING_KEY_PATH", "./keys/verifying.key"),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

