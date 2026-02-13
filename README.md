# Outpost

**Outpost** is an AI-powered lead research and outreach tool that automates company discovery, research, and personalized cold email generation.

Given a simple search (industry, location, goal), Outpost finds relevant companies, reads their websites, understands what they do, and generates tailored outreach emails — removing hours of manual research and writing.

---

## What Outpost Does

Outpost automates the most time-consuming parts of cold outreach:

1. **Company discovery**  
   Finds relevant companies based on industry and location using public web sources.

2. **Company research**  
   Visits each company’s website and extracts meaningful information about their product, market, and positioning.

3. **AI-powered summarization**  
   Uses large language models to generate concise company summaries and personalization hooks.

4. **Personalized outreach drafts**  
   Generates custom cold email drafts for each company based on what was learned from their website.

The output is a structured list of companies with summaries and ready-to-send email drafts.

---

## Example Use Cases

- Founders contacting potential partners or early customers
- Freelancers and consultants prospecting new clients
- Anyone who needs personalized outreach at scale

Outpost is designed to be **general-purpose**, with flexible prompts that adapt to different outreach goals.

---

## How It Works

1. User submits a search query (industry, location, intent)
2. A background workflow discovers relevant company websites
3. Each website is fetched and analyzed
4. AI models summarize the company and generate outreach copy
5. Results are stored and presented in a simple web interface
6. Users can view or export the generated leads and emails

---

## Architecture Overview

Outpost is built as a cloud-native, event-driven system on AWS.

### Core Components

- **API Gateway** – Entry point for client requests
- **AWS Lambda** – Stateless processing (discovery, scraping, enrichment, generation)
- **AWS Step Functions** – Workflow orchestration
- **DynamoDB** – Persistent storage for runs and leads
- **Amazon S3** – Storage for raw website data and exports
- **LLM Provider (Bedrock / OpenAI)** – Summarization and email generation

This architecture enables:

- Reliable background job execution
- Automatic retries and failure handling
- Horizontal scaling without managing servers

---

---

## Roadmap

- [x] **Core Backend**: Serverless API for managing research runs.
- [x] **Event-Driven Architecture**: Asynchronous processing pipeline using DynamoDB Streams.
- [x] **Infrastructure as Code**: Fully automated deployment with AWS CDK.
- [ ] **Real-Time Search**: Integrate SerpApi for live web search results.
- [ ] **AI Analysis**: Implement LLM-based summarization of company websites.
- [ ] **Frontend Dashboard**: Build a React/Next.js interface for users.

---

## Tech Stack

### Frontend

- Next.js

### Backend

- AWS Lambda
- API Gateway
- Step Functions

### Storage

- DynamoDB
- Amazon S3

### AI

- LLM integration (TBD)

### Infrastructure

- AWS CDK (Infrastructure as Code)

---

## Why This Project Exists

Cold outreach requires repetitive research and writing that can be automated.

Outpost explores how cloud-native systems and AI models can work together to:

- Automate real-world workflows
- Orchestrate complex background jobs
- Generate useful outputs, not demos

The goal is to demonstrate production-style system design and practical AI usage.

---

## Disclaimer

Outpost uses publicly available website data.

It does not scrape private platforms (e.g., LinkedIn) and is intended for educational and experimental use.

---

## License

MIT License

---

## Deployment

Outpost infrastructure is defined as code using **AWS CDK**.

### Prerequisites

- [AWS CLI](https://aws.amazon.com/cli/) installed and configured
- Node.js installed

### Setup

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Bootstrap CDK** (First time only):

   ```bash
   cd infra
   npx cdk bootstrap
   ```

3. **Deploy Stack**:

   ```bash
   npx cdk deploy
   ```

   This command will compile the infrastructure and provision:
   - **DynamoDB Tables** (Runs, Leads) with Streams enabled.
   - **Lambda Functions** (CreateRun, ProcessRun) with scoped IAM permissions.
   - **API Gateway** for the public API.

### Verification

After deployment, CDK will output the `ApiEndpoint`. You can test the end-to-end pipeline:

```bash
curl -X POST <API_ENDPOINT>/runs \
  -H "Content-Type: application/json" \
  -d '{"query": "San Francisco Coffee"}'
```

Check the `RunsTable` in DynamoDB to see the run status update to `COMPLETED` and leads populated in `LeadsTable`.
