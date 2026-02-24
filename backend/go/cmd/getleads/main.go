package main

import (
	"context"
	"log/slog"
	"os"

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

var GsiName = os.Getenv("LEADS_GSI_NAME")

func handler(ctx context.Context, request events.APIGatewayV2HTTPRequest) (events.APIGatewayProxyResponse, error) {
	runId := request.PathParameters["id"]
	if runId == "" {
		return api.CreateResponse(400, map[string]string{"error": "Missing run ID"})
	}

	userID, err := api.GetUserID(request)
	if err != nil {
		return api.CreateResponse(401, map[string]string{"error": "Unauthorized"})
	}

	// Step 1: Verify the user owns the Run before fetching the leads
	runOut, err := db.Client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(db.RunsTableName),
		Key: map[string]types.AttributeValue{
			"id": &types.AttributeValueMemberS{Value: runId},
		},
	})
	if err != nil {
		slog.Error("Got error calling GetItem for run verification", "error", err)
		return api.CreateResponse(500, map[string]string{"error": "Internal server error"})
	}
	if runOut.Item == nil {
		return api.CreateResponse(404, map[string]string{"error": "Run not found"})
	}

	var run models.RunItem
	if err := attributevalue.UnmarshalMap(runOut.Item, &run); err != nil {
		slog.Error("Failed to unmarshal run item", "error", err)
		return api.CreateResponse(500, map[string]string{"error": "Internal server error"})
	}

	// Compare User ID unless testing anonymously
	if run.UserID != userID {
		slog.Warn("Unauthorized access attempt to leads", "runId", runId, "requestedBy", userID)
		return api.CreateResponse(403, map[string]string{"error": "Forbidden"})
	}

	// Step 2: Fetch the leads now that ownership is verified

	out, err := db.Client.Query(ctx, &dynamodb.QueryInput{
		TableName:              aws.String(db.LeadsTableName),
		IndexName:              aws.String(GsiName),
		KeyConditionExpression: aws.String("runId = :runId"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":runId": &types.AttributeValueMemberS{Value: runId},
		},
	})

	if err != nil {
		slog.Error("Got error calling Query", "error", err)
		return api.CreateResponse(500, map[string]string{"error": "Internal server error"})
	}

	var leads []models.LeadItem
	err = attributevalue.UnmarshalListOfMaps(out.Items, &leads)
	if err != nil {
		slog.Error("Failed to unmarshal response items", "error", err)
		return api.CreateResponse(500, map[string]string{"error": "Internal server error"})
	}

	if leads == nil {
		leads = make([]models.LeadItem, 0)
	}

	return api.CreateResponse(200, map[string]interface{}{
		"leads": leads,
	})
}

func main() {
	lambda.Start(handler)
}
