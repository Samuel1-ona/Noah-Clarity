package main

import (
	"fmt"
	"os"
)

// Config holds the attester service configuration
type Config struct {
	Port            string
	PrivateKey      string
	AttesterID      uint
	VerifyingKeyPath string
}

// LoadConfig loads configuration from environment variables
func LoadConfig() *Config {
	return &Config{
		Port:            getEnv("ATTESTER_PORT", "8081"),
		PrivateKey:      getEnv("ATTESTER_PRIVATE_KEY", ""),
		AttesterID:      uint(getEnvUint("ATTESTER_ID", 1)),
		VerifyingKeyPath: getEnv("VERIFYING_KEY_PATH", "../prover/keys/verifying.key"),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvUint(key string, defaultValue uint) uint {
	if value := os.Getenv(key); value != "" {
		var result uint
		_, err := fmt.Sscanf(value, "%d", &result)
		if err == nil {
			return result
		}
	}
	return defaultValue
}

