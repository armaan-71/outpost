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

var GsiName = os.Getenv("LEADS_GSI_NAME")

func handler(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	runId := request.PathParameters["id"]
	if runId == "" {
		return api.CreateResponse(400, map[string]string{"error": "Missing run ID"})
	}

	out, err := db.Client.Query(ctx, &dynamodb.QueryInput{
		TableName:              aws.String(db.LeadsTableName),
		IndexName:              aws.String(GsiName),
		KeyConditionExpression: aws.String("runId = :runId"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":runId": &types.AttributeValueMemberS{Value: runId},
		},
	})

	if err != nil {
		fmt.Printf("Got error calling Query: %v\n", err)
		return api.CreateResponse(500, map[string]string{"error": "Internal server error"})
	}

	var leads []map[string]interface{}
	err = attributevalue.UnmarshalListOfMaps(out.Items, &leads)
	if err != nil {
		fmt.Printf("Failed to unmarshal response items: %v\n", err)
		return api.CreateResponse(500, map[string]string{"error": "Internal server error"})
	}

	if leads == nil {
		leads = make([]map[string]interface{}, 0)
	}

	return api.CreateResponse(200, map[string]interface{}{
		"leads": leads,
	})
}

func main() {
	lambda.Start(handler)
}
