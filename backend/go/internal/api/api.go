package api

import (
	"encoding/json"

	"github.com/aws/aws-lambda-go/events"
)

func CreateResponse(statusCode int, body interface{}) (events.APIGatewayProxyResponse, error) {
	jsonBody, err := json.Marshal(body)
	if err != nil {
		return events.APIGatewayProxyResponse{
			StatusCode: 500,
			Body:       `{"error": "Internal server error encoding response"}`,
			Headers: map[string]string{
				"Content-Type":                 "application/json",
				"Access-Control-Allow-Origin":  "*",
				"Access-Control-Allow-Methods": "GET,POST,OPTIONS",
			},
		}, nil
	}

	return events.APIGatewayProxyResponse{
		StatusCode: statusCode,
		Body:       string(jsonBody),
		Headers: map[string]string{
			"Content-Type":                 "application/json",
			"Access-Control-Allow-Origin":  "*",
			"Access-Control-Allow-Methods": "GET,POST,OPTIONS",
		},
	}, nil
}
