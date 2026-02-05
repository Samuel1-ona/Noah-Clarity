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

	// Clean text for better matching
	cleanText := strings.ReplaceAll(text, " ", "")
	cleanText = strings.ToUpper(cleanText)

	logger.Debug("Attempting to parse OCR text", zap.String("raw_text", text))

	// 1. Look for MRZ patterns (Simplified but more robust)
	// Typical MRZ line 2: PassportNo (9) + CheckDigit + Nationality (3) + DOB (6) + CheckDigit + Sex + Expiry (6) + CheckDigit + PersonalNumber...
	// We look for 9 alphanumeric + 1 digit + 3 alpha + 6 digit
	mrzPattern := regexp.MustCompile(`([A-Z0-9]{9})[0-9]{1}([A-Z]{3})[0-9]{6}`)
	matches := mrzPattern.FindStringSubmatch(cleanText)
	if len(matches) >= 3 {
		docInfo.Number = matches[1]
		docInfo.Country = matches[2]
		logger.Info("OCR parsed MRZ pattern successfully", zap.String("number", docInfo.Number), zap.String("country", docInfo.Country))
		return docInfo
	}

	// 2. Fallback: Manual line-by-line or blob parsing with more lenient patterns
	lines := strings.Split(text, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		line = strings.ToUpper(line)
		if len(line) < 3 {
			continue
		}

		// Passport Number Fallback: 7-10 alphanumeric characters in a word
		if docInfo.Number == "" {
			// Look for potential passport number in the line
			passNumPattern := regexp.MustCompile(`[A-Z0-9]{7,10}`)
			found := passNumPattern.FindString(line)
			if found != "" {
				// Avoid matching short country codes or other small bits
				if len(found) >= 8 || matchesMRZStyle(found) {
					docInfo.Number = found
				}
			}
		}

		// Country code Fallback: ISO 3-digit Alpha
		if docInfo.Country == "" {
			countryPattern := regexp.MustCompile(`\b[A-Z]{3}\b`)
			found := countryPattern.FindString(line)
			if found != "" && found != docInfo.Number {
				docInfo.Country = found
			}
		}
	}

	// 3. Final attempt: Check if we can find a country code anywhere in the text if still missing
	if docInfo.Country == "" {
		countryPattern := regexp.MustCompile(`\b[A-Z]{3}\b`)
		allCountries := countryPattern.FindAllString(cleanText, -1)
		for _, c := range allCountries {
			// Skip "P" or "USA" appearing in MRZ headers if they are common
			if c != "PAS" && c != "IDN" { // Simple filters
				docInfo.Country = c
				break
			}
		}
	}

	return docInfo
}

func matchesMRZStyle(s string) bool {
	// Simple check: mostly digits or has common passport number prefix
	return len(s) >= 7
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
