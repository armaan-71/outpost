import { DynamoDBStreamEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const ssmClient = new SSMClient({});
const s3Client = new S3Client({});

const RUNS_TABLE = process.env.RUNS_TABLE_NAME!;
const LEADS_TABLE = process.env.LEADS_TABLE_NAME!;

const SERP_API_KEY_PARAM_NAME = process.env.SERPAPI_KEY_PARAM_NAME!;
const RAW_DATA_BUCKET = process.env.RAW_DATA_BUCKET_NAME!;

let cachedSerpApiKey: string | null = null;

async function getSerpApiKey(): Promise<string> {
  if (cachedSerpApiKey) return cachedSerpApiKey;

  console.log(`Fetching secret from SSM: ${SERP_API_KEY_PARAM_NAME}`);
  const command = new GetParameterCommand({
    Name: SERP_API_KEY_PARAM_NAME,
    WithDecryption: true,
  });

  const response = await ssmClient.send(command);
  if (!response.Parameter || !response.Parameter.Value) {
    throw new Error('Secret not found in SSM');
  }

  cachedSerpApiKey = response.Parameter.Value;
  return cachedSerpApiKey;
}

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
      // 1. Get API Key (Securely)
      const apiKey = await getSerpApiKey();

      // 2. Call SerpApi
      const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&api_key=${apiKey}&num=10`;
      console.log(`Fetching SerpApi: ${url.replace(apiKey, '***')}`);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`SerpApi failed with status ${response.status}: ${response.statusText}`);
      }

      const data = await response.json(); // Use unknown for safety

      // 2.5 Save Raw Data to S3 (Partitioned by Date)
      if (RAW_DATA_BUCKET) {
        try {
          const date = new Date().toISOString().split('T')[0].replace(/-/g, '/'); // YYYY/MM/DD
          await s3Client.send(
            new PutObjectCommand({
              Bucket: RAW_DATA_BUCKET,
              Key: `runs/${date}/${runId}.json`,
              Body: JSON.stringify(data, null, 2),
              ContentType: 'application/json',
            }),
          );
          console.log(`Saved raw data to s3://${RAW_DATA_BUCKET}/runs/${date}/${runId}.json`);
        } catch (s3Error) {
          console.error('Failed to save raw data to S3:', s3Error);
          // Don't fail the whole run if S3 fails, just log it.
        }
      }

      // Validation
      if (!data || typeof data !== 'object' || !('organic_results' in data)) {
        console.error('Invalid SerpApi response:', JSON.stringify(data));
        throw new Error('SerpApi response missing organic_results');
      }

      const results = (data as { organic_results: SerpResult[] }).organic_results || [];
      console.log(`Found ${results.length} organic_results`);

      // 3. Map to Leads
      const leads: Lead[] = results.map((r, i) => {
        let domain = r.link;
        try {
          domain = new URL(r.link).hostname;
        } catch {
          console.warn(`Failed to parse domain from link: ${r.link}`);
        }

        return {
          id: `${runId}#${Date.now()}#${i}`,
          runId,
          companyName: r.title,
          domain,
          description: r.snippet,
          status: 'NEW',
          source: 'google-serp',
          createdAt: new Date().toISOString(),
        };
      });

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
