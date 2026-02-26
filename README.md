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
2. A background workflow processes the query:
   - **Smart Discovery**: An LLM rewrites the query and selects the best search engine (Google or Google Maps) based on intent.
   - **Multi-query Execution**: Multiple optimized searches run concurrently to maximize relevant results while filtering out noise (like listicles).
3. Each company website is fetched and analyzed
4. AI models summarize the company and generate highly-personalized outreach copy
5. Results are stored and presented in a simple web interface
6. Users can view or export the generated leads and emails

---

## Architecture Overview

Outpost is built as a cloud-native, event-driven system on AWS.

### Core Components

- **Auth** - Clerk for user authentication and API protection
- **API Gateway** – Entry point for client requests, secured via Clerk JWT Authorizer
- **AWS Lambda (Go)** – High-performance, low-latency CRUD API operations (`createRun`, `getRuns`, etc.)
- **AWS Lambda (Python)** – Data-processing pipeline for smart discovery, scraping, enrichment, and LLM generation
- **AWS Step Functions** – Workflow orchestration
- **DynamoDB** – Persistent storage (Runs, Leads)
- **Amazon S3** – Data Lake for raw SerpApi JSON results
- **AI Provider** – **Groq** (Llama 3.3 70B) for high-speed query analysis, summarization, and email drafting

This architecture enables:

- Reliable background job execution
- Automatic retries and failure handling
- Horizontal scaling without managing servers

---

---

## Roadmap

- [x] **Backend Migration**: API rewritten in Go for speed, processing pipeline rewritten in Python for data/AI ecosystem compatibility.
- [x] **Event-Driven Architecture**: Asynchronous processing pipeline using DynamoDB Streams.
- [x] **Infrastructure as Code**: Fully automated deployment with AWS CDK.
- [x] **Real-Time Search**: Integrate SerpApi for live web search results.
- [x] **Data Lake**: Store raw search data in S3 for AI analysis.
- [x] **AI Analysis**: Integrated **Groq (Llama 3.3)** for intelligent company summarization and email drafting.
- [x] **Smart Discovery Pipeline**: LLM-powered query rewriting and dynamic search engine selection (`google` vs `google_maps`) to drastically improve lead quality.
- [x] **Frontend Dashboard**: Build a React/Next.js interface for users.
- [x] **Authentication**: Integrated Clerk for user signup, login, and secure API access.

---

## Tech Stack

### Frontend

- Next.js (App Router)
- Tailwind CSS
- Clerk (Authentication)

### Backend

- **Go (Golang)** – High-speed CRUD REST API functions
- **Python** – Heavy-duty data processing and LLM inference functions
- AWS Lambda
- API Gateway
- Step Functions

### Storage

- DynamoDB
- Amazon S3

### AI

- **Groq** (Llama 3.3 70B)
- OpenAI-compatible SDK

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

3. **Configure Secrets (SSM)**:
   Store your SerpApi key in AWS Systems Manager Parameter Store:

   ```bash
   aws ssm put-parameter \
     --name "/outpost/prod/serpapi_key" \
     --value "YOUR_SERPAPI_KEY" \
     --type "SecureString"

   aws ssm put-parameter \
     --name "/outpost/prod/groq_api_key" \
     --value "YOUR_GROQ_API_KEY" \
     --type "SecureString"
   ```

4. **Deploy Stack**:

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

Check:

1. **DynamoDB**: `RunsTable` (Status: COMPLETED), `LeadsTable` (Extracted leads).
2. **S3**: `RawDataBucket` contains the full JSON response from SerpApi.
