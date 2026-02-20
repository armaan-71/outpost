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

var GsiName = os.Getenv("RUNS_GSI_NAME")

func handler(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	// Query the GSI for all RUNs, sorted by createdAt desc
	out, err := db.Client.Query(ctx, &dynamodb.QueryInput{
		TableName:              aws.String(db.RunsTableName),
		IndexName:              aws.String(GsiName),
		KeyConditionExpression: aws.String("entityType = :entityType"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":entityType": &types.AttributeValueMemberS{Value: models.EntityTypeRun},
		},
		ScanIndexForward: aws.Bool(false),
	})

	if err != nil {
		slog.Error("Got error calling Query", "error", err)
		return api.CreateResponse(500, map[string]string{"error": "Internal server error"})
	}

	var runs []models.RunItem
	err = attributevalue.UnmarshalListOfMaps(out.Items, &runs)
	if err != nil {
		slog.Error("Failed to unmarshal response items", "error", err)
		return api.CreateResponse(500, map[string]string{"error": "Internal server error"})
	}

	if runs == nil {
		runs = make([]models.RunItem, 0)
	}

	return api.CreateResponse(200, map[string]interface{}{
		"runs": runs,
	})
}

func main() {
	lambda.Start(handler)
}
