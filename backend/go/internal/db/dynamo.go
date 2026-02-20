package db

import (
	"context"
	"fmt"
	"os"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
)

var (
	RunsTableName  = os.Getenv("RUNS_TABLE_NAME")
	LeadsTableName = os.Getenv("LEADS_TABLE_NAME")
	Client         *dynamodb.Client
)

func init() {
	// Initialize the DynamoDB client once during container startup (Cold Start)
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		fmt.Printf("unable to load SDK config, %v\n", err)
		return
	}
	Client = dynamodb.NewFromConfig(cfg)
}
