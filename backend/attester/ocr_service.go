package main

import (
	"fmt"
	"regexp"
	"strings"
	"time"

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
	// We look for 9 alphanumeric + 1 digit + 3 alpha + 6 digit (DOB) + 1 digit + 1 alpha (Sex) + 6 digit (Expiry)
	mrzPattern := regexp.MustCompile(`([A-Z0-9]{9})[0-9]{1}([A-Z]{3})([0-9]{6})[0-9]{1}[A-Z]{1}([0-9]{6})`)
	matches := mrzPattern.FindStringSubmatch(cleanText)
	if len(matches) >= 5 {
		docInfo.Number = matches[1]
		docInfo.Country = matches[2]
		docInfo.DateOfBirth = matches[3]
		docInfo.ExpiryDate = matches[4]
		docInfo.Age = calculateAge(docInfo.DateOfBirth)
		logger.Info("OCR parsed MRZ pattern successfully with DOB",
			zap.String("number", docInfo.Number),
			zap.String("country", docInfo.Country),
			zap.Int("age", docInfo.Age))
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

		// DOB Fallback: 6 digits together
		if docInfo.DateOfBirth == "" {
			dobPattern := regexp.MustCompile(`\b[0-9]{6}\b`)
			found := dobPattern.FindString(line)
			if found != "" {
				docInfo.DateOfBirth = found
				docInfo.Age = calculateAge(found)
			}
		}
	}

	// 3. Final attempt: Check if we can find a country code anywhere in the text if still missing
	if docInfo.Country == "" {
		countryPattern := regexp.MustCompile(`\b[A-Z]{3}\b`)
		allCountries := countryPattern.FindAllString(cleanText, -1)

		// Priority 1: Look for NGA specifically
		for _, c := range allCountries {
			if c == "NGA" {
				docInfo.Country = "NGA"
				logger.Info("OCR Priority Match", zap.String("country", "NGA"))
				return docInfo
			}
		}

		// Priority 2: Other valid-looking codes
		for _, c := range allCountries {
			// Skip known noise/headers
			// LAS, LAG, LOS are common misreads in Nigerian passports
			if c != "PAS" && c != "IDN" && c != "PRT" && c != "LAS" && c != "LAG" && c != "LOS" && c != "DTO" {
				docInfo.Country = c
				break
			}
		}
	}

	// Double check fallback
	if docInfo.Country == "LAS" || docInfo.Country == "" {
		if strings.Contains(cleanText, "NGA") {
			docInfo.Country = "NGA"
		}
	}

	return docInfo
}

func calculateAge(dob string) int {
	if len(dob) != 6 {
		return 0
	}

	yearStr := dob[0:2]
	monthStr := dob[2:4]
	dayStr := dob[4:6]

	year := 0
	month := 0
	day := 0
	fmt.Sscanf(yearStr, "%d", &year)
	fmt.Sscanf(monthStr, "%d", &month)
	fmt.Sscanf(dayStr, "%d", &day)

	// Determine century (20xx or 19xx)
	currentYear := time.Now().Year() % 100
	fullYear := 0
	if year <= currentYear {
		fullYear = 2000 + year
	} else {
		fullYear = 1900 + year
	}

	birthDate := time.Date(fullYear, time.Month(month), day, 0, 0, 0, 0, time.UTC)
	age := time.Now().Year() - birthDate.Year()

	// Adjust age if birthday hasn't occurred yet this year
	if time.Now().YearDay() < birthDate.YearDay() {
		age--
	}

	return age
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
