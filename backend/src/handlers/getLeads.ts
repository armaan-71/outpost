import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { createApiResponse } from '../utils/apiResponse';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.LEADS_TABLE_NAME!;
const GSI_NAME = process.env.LEADS_GSI_NAME!;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const runId = event.pathParameters?.id;

    if (!runId) {
      return createApiResponse(400, { error: 'Missing run ID' });
    }

    const command = new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: GSI_NAME,
      KeyConditionExpression: 'runId = :runId',
      ExpressionAttributeValues: {
        ':runId': runId,
      },
    });

    const response = await docClient.send(command);

    return createApiResponse(200, { leads: response.Items || [] });
  } catch (error) {
    console.error('Error fetching leads:', error);
    return createApiResponse(500, { error: 'Internal server error' });
  }
};
