package main

import (
	"context"
	"log/slog"

	"github.com/armaan-71/outpost/backend/go/internal/api"
	"github.com/armaan-71/outpost/backend/go/internal/db"
	models "github.com/armaan-71/outpost/backend/go/internal/types"
	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

func handler(ctx context.Context, request events.APIGatewayV2HTTPRequest) (events.APIGatewayProxyResponse, error) {
	runId := request.PathParameters["id"]
	if runId == "" {
		return api.CreateResponse(400, map[string]string{"error": "Missing run ID"})
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

	out, err := db.Client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(db.RunsTableName),
		Key: map[string]types.AttributeValue{
			"id": &types.AttributeValueMemberS{Value: runId},
		},
	})

	if err != nil {
		slog.Error("Got error calling GetItem", "error", err)
		return api.CreateResponse(500, map[string]string{"error": "Internal server error"})
	}

	if out.Item == nil {
		return api.CreateResponse(404, map[string]string{"error": "Run not found"})
	}

	var run models.RunItem
	err = attributevalue.UnmarshalMap(out.Item, &run)
	if err != nil {
		slog.Error("Failed to unmarshal response item", "error", err)
		return api.CreateResponse(500, map[string]string{"error": "Internal server error"})
	}

	if run.UserID != userID && userID != "anonymous" {
		slog.Warn("Unauthorized access attempt", "runId", runId, "requestedBy", userID, "ownerId", run.UserID)
		return api.CreateResponse(403, map[string]string{"error": "Forbidden"})
	}

	return api.CreateResponse(200, map[string]interface{}{
		"run": run,
	})
}

func main() {
	lambda.Start(handler)
}
