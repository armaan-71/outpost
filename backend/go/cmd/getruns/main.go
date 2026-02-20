package main

import (
	"context"
	"fmt"
	"os"

	"github.com/armaan-71/outpost/backend/go/internal/api"
	"github.com/armaan-71/outpost/backend/go/internal/db"
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
			":entityType": &types.AttributeValueMemberS{Value: "RUN"},
		},
		ScanIndexForward: aws.Bool(false),
	})

	if err != nil {
		fmt.Printf("Got error calling Query: %v\n", err)
		return api.CreateResponse(500, map[string]string{"error": "Internal server error"})
	}

	var runs []map[string]interface{}
	err = attributevalue.UnmarshalListOfMaps(out.Items, &runs)
	if err != nil {
		fmt.Printf("Failed to unmarshal response items: %v\n", err)
		return api.CreateResponse(500, map[string]string{"error": "Internal server error"})
	}

	if runs == nil {
		runs = make([]map[string]interface{}, 0)
	}

	return api.CreateResponse(200, map[string]interface{}{
		"runs": runs,
	})
}

func main() {
	lambda.Start(handler)
}
