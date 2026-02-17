import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { createApiResponse } from '../utils/apiResponse';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.RUNS_TABLE_NAME!;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const runId = event.pathParameters?.id;

    if (!runId) {
      return createApiResponse(400, { error: 'Missing run ID' });
    }

    const command = new GetCommand({
      TableName: TABLE_NAME,
      Key: { id: runId },
    });

    const response = await docClient.send(command);

    if (!response.Item) {
      return createApiResponse(404, { error: 'Run not found' });
    }

    return createApiResponse(200, { run: response.Item });
  } catch (error) {
    console.error('Error fetching run:', error);
    return createApiResponse(500, { error: 'Internal server error' });
  }
};
