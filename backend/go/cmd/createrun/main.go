package main

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/armaan-71/outpost/backend/go/internal/api"
	"github.com/armaan-71/outpost/backend/go/internal/db"
	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/google/uuid"
)

type RunRequestBody struct {
	Query    string `json:"query"`
	Location string `json:"location,omitempty"`
}

type RunItem struct {
	ID         string `dynamodbav:"id"`
	EntityType string `dynamodbav:"entityType"`
	Query      string `dynamodbav:"query"`
	Location   string `dynamodbav:"location,omitempty"`
	Status     string `dynamodbav:"status"`
	CreatedAt  string `dynamodbav:"createdAt"`
}

func handler(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	var body RunRequestBody
	err := json.Unmarshal([]byte(request.Body), &body)
	if err != nil {
		fmt.Printf("Error unmarshalling body: %v\n", err)
		return api.CreateResponse(400, map[string]string{"error": "Invalid JSON body"})
	}

	if body.Query == "" {
		return api.CreateResponse(400, map[string]string{"error": "Missing required field: query"})
	}

	now := time.Now().UTC().Format(time.RFC3339)
	runId := uuid.New().String()

	item := RunItem{
		ID:         runId,
		EntityType: "RUN",
		Query:      body.Query,
		Location:   body.Location,
		Status:     "PENDING",
		CreatedAt:  now,
	}

	av, err := attributevalue.MarshalMap(item)
	if err != nil {
		fmt.Printf("Got error marshalling new item: %v\n", err)
		return api.CreateResponse(500, map[string]string{"error": "Internal server error"})
	}

	_, err = db.Client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(db.RunsTableName),
		Item:      av,
	})

	if err != nil {
		fmt.Printf("Got error calling PutItem: %v\n", err)
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
