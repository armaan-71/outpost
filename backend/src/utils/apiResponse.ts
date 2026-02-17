import { APIGatewayProxyResult } from 'aws-lambda';

/**
 * Creates a standard API Gateway response with CORS headers.
 * @param statusCode - HTTP status code
 * @param body - Response body (automtically stringified)
 * @returns APIGatewayProxyResult
 */
export const createApiResponse = (statusCode: number, body: object): APIGatewayProxyResult => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  },
  body: JSON.stringify(body),
});
