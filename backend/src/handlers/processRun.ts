import { DynamoDBStreamEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const RUNS_TABLE = process.env.RUNS_TABLE_NAME!;
const LEADS_TABLE = process.env.LEADS_TABLE_NAME!;

interface Lead {
  runId: string;
  domain: string;
  email?: string;
  status: 'NEW';
  kwargs: Record<string, string>;
}

export const handler = async (event: DynamoDBStreamEvent): Promise<void> => {
  for (const record of event.Records) {
    if (record.eventName !== 'INSERT') continue;

    const runId = record.dynamodb?.Keys?.id?.S;
    if (!runId) continue;

    // 1. Mock "Search" Logic
    const mockLeads: Lead[] = Array.from({ length: 5 }).map((_, i) => ({
      runId,
      domain: `example-${i}.com`,
      email: `contact@example-${i}.com`,
      status: 'NEW',
      kwargs: { source: 'mock-generator' },
    }));

    try {
      // 2. Save Leads
      // Note: BatchWrite can handle max 25 items. For real app, use loop/chunking.
      await docClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [LEADS_TABLE]: mockLeads.map((lead) => ({
              PutRequest: { Item: lead },
            })),
          },
        }),
      );

      // 3. Update Run Status
      await docClient.send(
        new UpdateCommand({
          TableName: RUNS_TABLE,
          Key: { id: runId },
          UpdateExpression: 'SET #status = :status, leadsCount = :count, updatedAt = :updatedAt',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':status': 'COMPLETED',
            ':count': mockLeads.length,
            ':updatedAt': new Date().toISOString(),
          },
        }),
      );

      console.log(`Successfully processed run ${runId}`);
    } catch (error) {
      console.error(`Error processing run ${runId}:`, error);

      // Attempt to mark run as FAILED
      await docClient
        .send(
          new UpdateCommand({
            TableName: RUNS_TABLE,
            Key: { id: runId },
            UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: {
              ':status': 'FAILED',
              ':updatedAt': new Date().toISOString(),
            },
          }),
        )
        .catch((e) => console.error('Failed to update run status to FAILED:', e));
    }
  }
};
