import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';
import { createApiResponse } from '../utils/apiResponse';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.RUNS_TABLE_NAME!;

interface RunRequestBody {
  query?: string;
  location?: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const body = JSON.parse(event.body || '{}') as RunRequestBody;

    if (!body.query) {
      return createApiResponse(400, { error: 'Missing required field: query' });
    }

    const run = {
      id: randomUUID(),
      entityType: 'RUN', // For GSI Query
      query: body.query,
      location: body.location || null,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: run,
      }),
    );

    return createApiResponse(201, {
      message: 'Run created successfully',
      runId: run.id,
    });
  } catch (error) {
    console.error('Error creating run:', error);
    return createApiResponse(500, { error: 'Internal server error' });
  }
};
