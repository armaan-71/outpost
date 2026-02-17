import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { createApiResponse } from '../utils/apiResponse';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.RUNS_TABLE_NAME!;
const GSI_NAME = process.env.RUNS_GS1_NAME!;

export const handler = async (_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const command = new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: GSI_NAME,
      KeyConditionExpression: 'entityType = :entityType',
      ExpressionAttributeValues: {
        ':entityType': 'RUN',
      },
      ScanIndexForward: false, // Sort by createdAt desc
    });

    const response = await docClient.send(command);

    return createApiResponse(200, { runs: response.Items || [] });
  } catch (error) {
    console.error('Error fetching runs:', error);
    return createApiResponse(500, { error: 'Internal server error' });
  }
};
