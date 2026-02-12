import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

export const handler = (_event: APIGatewayProxyEvent): APIGatewayProxyResult => {
  // TODO: Parse search query from event.body, store a new run in DynamoDB
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      message: 'Run created successfully',
      runId: 'placeholder',
    }),
  };
};
