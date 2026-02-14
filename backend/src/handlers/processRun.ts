import { DynamoDBStreamEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const RUNS_TABLE = process.env.RUNS_TABLE_NAME!;
const LEADS_TABLE = process.env.LEADS_TABLE_NAME!;
const SERP_API_KEY = process.env.SERPAPI_KEY!;

interface Lead {
  id: string; // Unique ID for the lead (e.g., RunId#Timestamp#Index)
  runId: string;
  domain: string;
  companyName: string;
  description: string;
  status: 'NEW';
  source: 'google-serp';
  createdAt: string;
}

interface SerpResult {
  title: string;
  link: string;
  snippet: string;
}

export const handler = async (event: DynamoDBStreamEvent): Promise<void> => {
  for (const record of event.Records) {
    if (record.eventName !== 'INSERT') continue;

    const runId = record.dynamodb?.Keys?.id?.S;
    const query = record.dynamodb?.NewImage?.query?.S;

    if (!runId || !query) {
      console.log('Skipping record without runId or query');
      continue;
    }

    console.log(`Processing Run: ${runId} | Query: "${query}"`);

    try {
      // 1. Check for API Key
      if (!SERP_API_KEY) {
        throw new Error('SERPAPI_KEY is missing in environment variables');
      }

      // 2. Call SerpApi
      const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&api_key=${SERP_API_KEY}&num=10`;
      console.log(`Fetching SerpApi: ${url.replace(SERP_API_KEY, '***')}`);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`SerpApi failed with status ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as { organic_results?: SerpResult[] };
      const results: SerpResult[] = data.organic_results || [];
      console.log(`Found ${results.length} organic results`);

      // 3. Map to Leads
      const leads: Lead[] = results.map((r, i) => ({
        id: `${runId}#${Date.now()}#${i}`,
        runId,
        companyName: r.title,
        domain: r.link,
        description: r.snippet,
        status: 'NEW',
        source: 'google-serp',
        createdAt: new Date().toISOString(),
      }));

      // 4. Save Leads (BatchWrite limit is 25 items)
      if (leads.length > 0) {
        // Chunk into batches of 25 if needed (for now assume < 25)
        const chunks = [];
        for (let i = 0; i < leads.length; i += 25) {
          chunks.push(leads.slice(i, i + 25));
        }

        for (const chunk of chunks) {
          await docClient.send(
            new BatchWriteCommand({
              RequestItems: {
                [LEADS_TABLE]: chunk.map((lead) => ({
                  PutRequest: { Item: lead },
                })),
              },
            }),
          );
        }
        console.log(`Saved ${leads.length} leads to DynamoDB`);
      } else {
        console.log('No leads found from SerpApi');
      }

      // 5. Update Run Status to COMPLETED
      await docClient.send(
        new UpdateCommand({
          TableName: RUNS_TABLE,
          Key: { id: runId },
          UpdateExpression: 'SET #status = :status, leadsCount = :count, updatedAt = :updatedAt',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':status': 'COMPLETED',
            ':count': leads.length,
            ':updatedAt': new Date().toISOString(),
          },
        }),
      );

      console.log(`Successfully completed run ${runId}`);
    } catch (error) {
      console.error(`Error processing run ${runId}:`, error);

      // Attempt to mark run as FAILED
      await docClient
        .send(
          new UpdateCommand({
            TableName: RUNS_TABLE,
            Key: { id: runId },
            UpdateExpression: 'SET #status = :status, error = :error, updatedAt = :updatedAt',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: {
              ':status': 'FAILED',
              ':error': (error as Error).message,
              ':updatedAt': new Date().toISOString(),
            },
          }),
        )
        .catch((e) => console.error('Failed to update run status to FAILED:', e));
    }
  }
};
