package main

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/armaan-71/outpost/backend/go/internal/api"
	"github.com/armaan-71/outpost/backend/go/internal/db"
	models "github.com/armaan-71/outpost/backend/go/internal/types"
	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/google/uuid"
)

func handler(ctx context.Context, request events.APIGatewayV2HTTPRequest) (events.APIGatewayProxyResponse, error) {
	var body models.RunRequestBody
	err := json.Unmarshal([]byte(request.Body), &body)
	if err != nil {
		slog.Error("Error unmarshalling body", "error", err)
		return api.CreateResponse(400, map[string]string{"error": "Invalid JSON body"})
	}

	if body.Query == "" {
		return api.CreateResponse(400, map[string]string{"error": "Missing required field: query"})
	}

	// Extract the User ID injected by API Gateway's Clerk Authorizer
	var userID string
	if claims, ok := request.RequestContext.Authorizer.JWT.Claims["sub"]; ok {
		userID = claims
	} else {
		// Fallback for local testing or unauthenticated routes if misconfigured
		slog.Warn("No sub claim found in authorizer context. Was JWT passed?")
		userID = "anonymous"
	}

	now := time.Now().UTC().Format(time.RFC3339)
	runId := uuid.New().String()

	item := models.RunItem{
		ID:         runId,
		UserID:     userID, // Save the user context
		EntityType: models.EntityTypeRun,
		Query:      body.Query,
		Location:   body.Location,
		Status:     models.StatusPending,
		CreatedAt:  now,
	}

	av, err := attributevalue.MarshalMap(item)
	if err != nil {
		slog.Error("Got error marshalling new item", "error", err)
		return api.CreateResponse(500, map[string]string{"error": "Internal server error"})
	}

	_, err = db.Client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(db.RunsTableName),
		Item:      av,
	})

	if err != nil {
		slog.Error("Got error calling PutItem", "error", err)
		return api.CreateResponse(500, map[string]string{"error": "Internal server error"})
	}

	return api.CreateResponse(201, map[string]string{
		"message": "Run created successfully",
		"runId":   runId,
	})
}

func main() {
	lambda.Start(handler)
}
