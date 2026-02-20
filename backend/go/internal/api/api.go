package api

import (
	"encoding/json"
	"os"

	"github.com/aws/aws-lambda-go/events"
)

var defaultHeaders map[string]string

func init() {
	allowedOrigin := os.Getenv("ALLOWED_ORIGIN")
	if allowedOrigin == "" {
		allowedOrigin = "*"
	}

	defaultHeaders = map[string]string{
		"Content-Type":                 "application/json",
		"Access-Control-Allow-Origin":  allowedOrigin,
		"Access-Control-Allow-Methods": "GET,POST,OPTIONS",
	}
}

func CreateResponse(statusCode int, body interface{}) (events.APIGatewayProxyResponse, error) {
	jsonBody, err := json.Marshal(body)
	if err != nil {
		return events.APIGatewayProxyResponse{
			StatusCode: 500,
			Body:       `{"error": "Internal server error encoding response"}`,
			Headers:    defaultHeaders,
		}, nil
	}

	return events.APIGatewayProxyResponse{
		StatusCode: statusCode,
		Body:       string(jsonBody),
		Headers:    defaultHeaders,
	}, nil
}
