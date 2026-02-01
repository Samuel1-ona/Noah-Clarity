package main

import (
	"fmt"
	"regexp"
	"strings"

	"noah-v2/backend/pkg/logger"

	"github.com/otiai10/gosseract/v2"
	"go.uber.org/zap"
)

// OCRService handles document text extraction
type OCRService struct {
	client *gosseract.Client
}

// NewOCRService creates a new OCR service
func NewOCRService() *OCRService {
	client := gosseract.NewClient()
	return &OCRService{
		client: client,
	}
}

// Close cleans up OCR resources
func (o *OCRService) Close() {
	if o.client != nil {
		o.client.Close()
	}
}

// ExtractPassportInfo extracts passport data from an image file
func (o *OCRService) ExtractPassportInfo(imagePath string) (*DocumentInfo, error) {
	if o.client == nil {
		return nil, fmt.Errorf("OCR client not initialized")
	}

	o.client.SetImage(imagePath)
	text, err := o.client.Text()
	if err != nil {
		logger.Error("OCR failed to extract text", zap.String("path", imagePath), zap.Error(err))
		return nil, fmt.Errorf("OCR extraction failed: %w", err)
	}

	logger.Info("OCR extracted text successfully", zap.String("path", imagePath), zap.Int("length", len(text)))

	docInfo := o.parsePassportText(text)

	if docInfo.Number == "" || docInfo.Country == "" {
		return nil, fmt.Errorf("failed to extract mandatory passport fields (number or country)")
	}

	return docInfo, nil
}

// parsePassportText uses regex to find passport number and country
func (o *OCRService) parsePassportText(text string) *DocumentInfo {
	docInfo := &DocumentInfo{
		Type: "Passport",
	}

	// 1. Look for MRZ patterns (Simplified)
	// Line 2 of MRZ: [PassportNo (9)][CheckDigit][Nationality (3)][DOB (6)]...
	mrzPattern := regexp.MustCompile(`([A-Z0-9]{9})[0-9]{1}([A-Z]{3})[0-9]{6}`)
	matches := mrzPattern.FindStringSubmatch(text)
	if len(matches) >= 3 {
		docInfo.Number = matches[1]
		docInfo.Country = matches[2]
		logger.Info("OCR parsed MRZ pattern", zap.String("number", docInfo.Number), zap.String("country", docInfo.Country))
		return docInfo
	}

	// 2. Fallback: Manual line parsing
	lines := strings.Split(text, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if len(line) == 0 {
			continue
		}

		// Passport Number: Usually 9 alpha-numeric characters
		if docInfo.Number == "" {
			passNumPattern := regexp.MustCompile(`^[A-Z0-9]{9}$`)
			if passNumPattern.MatchString(line) {
				docInfo.Number = line
			}
		}

		// Country code: ISO 3-digit Alpha
		if docInfo.Country == "" {
			countryPattern := regexp.MustCompile(`^[A-Z]{3}$`)
			if countryPattern.MatchString(line) {
				docInfo.Country = line
			}
		}
	}

	return docInfo
}

func isAlphaNumeric(s string) bool {
	for _, r := range s {
		if (r < 'a' || r > 'z') && (r < 'A' || r > 'Z') && (r < '0' || r > '9') {
			return false
		}
	}
	return true
}

func isAlpha(s string) bool {
	for _, r := range s {
		if (r < 'a' || r > 'z') && (r < 'A' || r > 'Z') {
			return false
		}
	}
	return true
}
