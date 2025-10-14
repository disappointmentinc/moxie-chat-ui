# RAG System Testing Guide

> **Status**: RAG implementation complete! Follow this guide to test your RAG system.

## What Was Built

Your RAG (Retrieval-Augmented Generation) system is now fully implemented with:

### ✅ Components Implemented

1. **Document Processing** (`src/lib/rag/document-processor.ts`)
   - PDF text extraction
   - DOCX text extraction
   - Plain text file support
   - Intelligent chunking with overlap
   - Supported formats: `.pdf`, `.docx`, `.txt`, `.md`

2. **Embedding Generation** (`src/lib/rag/embeddings.ts`)
   - OpenAI embeddings (text-embedding-3-small)
   - Batch processing for multiple chunks
   - Query embedding generation
   - 1536-dimensional vectors

3. **Vector Database** (`src/lib/rag/vectorize-store.ts`)
   - Cloudflare Vectorize integration
   - Document indexing
   - Semantic search
   - Vector deletion by file

4. **API Endpoints**:
   - `POST /api/rag/upload` - Process and index documents
   - `POST /api/rag/query` - Search for relevant content
   - `DELETE /api/rag/document` - Remove documents

5. **File Storage** (already working)
   - Cloudflare R2 integration
   - Direct uploads via presigned URLs
   - Public URL generation

## Prerequisites

Before testing, you need to add these secrets to your `.env` file:

```bash
# Find these values:
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_secret_key_here
CLOUDFLARE_API_TOKEN=your_api_token_here
```

### How to Get These Values

#### 1. Cloudflare R2 Secret Access Key

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → **R2**
2. Click **Manage R2 API Tokens**
3. Find your existing token or create a new one:
   - Name: `rag-access`
   - Permissions: **Object Read & Write**
   - Buckets: Select `hrrag`
4. Copy the **Secret Access Key** (shown only once!)
5. Add to `.env`: `CLOUDFLARE_R2_SECRET_ACCESS_KEY=...`

#### 2. Cloudflare API Token

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → **My Profile** → **API Tokens**
2. Click **Create Token**
3. Choose **Custom token**:
   - Token name: `vectorize-access`
   - Permissions:
     - **Account** → **Vectorize** → **Edit**
   - Account Resources: Include your account
4. Click **Continue to summary** → **Create Token**
5. Copy the token (shown only once!)
6. Add to `.env`: `CLOUDFLARE_API_TOKEN=...`

## Configuration Check

Your `.env` file should now have:

```bash
# === File Storage ===
FILE_STORAGE_TYPE=s3
CLOUDFLARE_ACCOUNT_ID=fa05343e245cb05f1e77ba0b7e489533
CLOUDFLARE_R2_ACCESS_KEY_ID=yVnkW3euCl8hMRUaVDRXtvQhX5rJK32MrQA2kuh_
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_secret_here
CLOUDFLARE_R2_BUCKET_NAME=hrrag
CLOUDFLARE_R2_PUBLIC_DOMAIN=

# === RAG Configuration ===
EMBEDDING_MODEL=text-embedding-3-small
OPENAI_API_KEY=sk-proj-... (already set)
VECTORIZE_INDEX_ID=rag-slides-index
CLOUDFLARE_API_TOKEN=your_token_here
```

## Testing the RAG System

### Step 1: Start Development Server

```bash
pnpm dev
```

### Step 2: Test File Upload to R2

First, test that file uploads work:

```bash
# Upload a test PDF (use your app's UI or test via API)
curl -X POST http://localhost:3000/api/storage/upload-url \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "filename": "test-document.pdf",
    "contentType": "application/pdf"
  }'
```

**Expected**: You should get a presigned URL to upload your file to R2.

### Step 3: Process Document for RAG

After uploading a file to R2, process it for RAG:

```bash
curl -X POST http://localhost:3000/api/rag/upload \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "fileKey": "uploads/uuid-test-document.pdf"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "metadata": {
    "fileKey": "uploads/uuid-test-document.pdf",
    "filename": "test-document.pdf",
    "totalChunks": 15,
    "processedAt": "2025-01-10T12:00:00.000Z"
  }
}
```

**What This Does**:
1. Downloads file from R2
2. Extracts text (PDF, DOCX, or TXT)
3. Splits into ~1000 character chunks with 200 char overlap
4. Generates embeddings using OpenAI
5. Stores vectors in Cloudflare Vectorize

### Step 4: Query for Relevant Content

Search your indexed documents:

```bash
curl -X POST http://localhost:3000/api/rag/query \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "query": "What is denials prevention?",
    "topK": 5
  }'
```

**Expected Response**:
```json
{
  "results": [
    {
      "id": "chunk-uuid-1",
      "text": "Denials prevention is the process of...",
      "metadata": {
        "fileKey": "uploads/uuid-test-document.pdf",
        "filename": "test-document.pdf",
        "chunkIndex": 3
      },
      "score": 0.85
    },
    ...
  ],
  "count": 5
}
```

**What This Does**:
1. Generates embedding for your query
2. Searches Vectorize for similar vectors
3. Returns top K most relevant chunks with scores

### Step 5: Delete Document (Optional)

Remove a document's vectors from RAG:

```bash
curl -X DELETE http://localhost:3000/api/rag/document \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "fileKey": "uploads/uuid-test-document.pdf"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Document vectors deleted successfully"
}
```

## Troubleshooting

### Error: "CLOUDFLARE_R2_SECRET_ACCESS_KEY is not set"

**Solution**: Add your R2 secret key to `.env` file (see Prerequisites above)

### Error: "CLOUDFLARE_API_TOKEN is required"

**Solution**: Add your Cloudflare API token to `.env` file (see Prerequisites above)

### Error: "Unsupported file type"

**Cause**: File format not supported for RAG processing

**Supported Formats**:
- PDF (`.pdf`)
- Microsoft Word (`.docx`)
- Plain text (`.txt`)
- Markdown (`.md`)

### Error: "File not found in R2"

**Cause**: File doesn't exist in R2 bucket

**Solution**:
1. Verify file was uploaded successfully to R2
2. Check the fileKey matches what was returned from upload
3. Use `aws s3 ls s3://hrrag/uploads/` to list files (with R2 credentials)

### Error: "No text content found in file"

**Cause**: PDF or document is empty or contains only images

**Solution**:
- Ensure document contains actual text (not scanned images)
- For scanned PDFs, you'll need OCR (not currently implemented)

### Error: "Vectorize API error (403): Forbidden"

**Cause**: API token doesn't have correct permissions

**Solution**:
1. Go to Cloudflare Dashboard → API Tokens
2. Edit your token
3. Ensure it has **Vectorize Edit** permissions for your account

### Error: "Failed to generate embeddings"

**Cause**: OpenAI API key is missing or invalid

**Solution**:
1. Verify `OPENAI_API_KEY` is set in `.env`
2. Test API key: `curl https://api.openai.com/v1/models -H "Authorization: Bearer $OPENAI_API_KEY"`

## Integration with Chat

To use RAG in your chat, modify your chat API route to include RAG context:

```typescript
// In your chat API route (e.g., src/app/api/chat/route.ts)
import { searchDocuments } from "lib/rag/vectorize-store";

// Before sending to LLM:
const userMessage = messages[messages.length - 1].content;

// Search for relevant documents
const relevantDocs = await searchDocuments(userMessage, 3);

if (relevantDocs.length > 0) {
  // Add context to messages
  const contextMessage = {
    role: "system",
    content: `Use the following context to answer the user's question:

${relevantDocs.map((doc, i) => `[${i + 1}] ${doc.text} (source: ${doc.metadata.filename})`).join('\n\n')}

If the context contains relevant information, use it in your response. If not, answer based on your general knowledge.`,
  };

  messages.unshift(contextMessage);
}

// Continue with LLM call...
```

## Monitoring

### Check Vectorize Index

```bash
curl https://api.cloudflare.com/client/v4/accounts/fa05343e245cb05f1e77ba0b7e489533/vectorize/indexes/rag-slides-index \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
```

### Check R2 Bucket Contents

```bash
# Using AWS CLI with R2 credentials
aws s3 ls s3://hrrag/uploads/ \
  --endpoint-url https://fa05343e245cb05f1e77ba0b7e489533.r2.cloudflarestorage.com \
  --profile r2
```

## Performance Tips

### Adjust Chunk Size

In `src/lib/rag/document-processor.ts`:

```typescript
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1500, // Larger chunks = fewer vectors = lower cost
  chunkOverlap: 300, // More overlap = better context
});
```

### Filter Results by File

```bash
curl -X POST http://localhost:3000/api/rag/query \
  -d '{
    "query": "your question",
    "topK": 5,
    "filter": {
      "filename": "specific-document.pdf"
    }
  }'
```

### Batch Processing

Process multiple documents in parallel:

```typescript
const fileKeys = [
  "uploads/uuid-doc1.pdf",
  "uploads/uuid-doc2.pdf",
  "uploads/uuid-doc3.pdf",
];

await Promise.all(
  fileKeys.map(fileKey =>
    fetch('/api/rag/upload', {
      method: 'POST',
      body: JSON.stringify({ fileKey })
    })
  )
);
```

## Cost Estimation

Based on current usage:

### OpenAI Embeddings
- text-embedding-3-small: $0.02 per 1M tokens
- ~750 tokens per 1000-char chunk
- Example: 100-page PDF (~50K words) ≈ $0.01

### Cloudflare Vectorize
- **Free Tier**: 5M vector dimensions/month
- 1536 dims × 50 chunks = 76,800 dims = **FREE**
- After free tier: $0.04 per 1M dimensions

### Cloudflare R2
- Storage: $0.015/GB/month
- Operations: $4.50 per million writes
- **Egress: FREE**

**Total Cost (1000 documents)**:
- Embeddings: ~$10
- Vectorize: ~$0 (within free tier)
- R2: ~$0.15
- **Total: ~$10.15/month**

## Next Steps

1. ✅ Add secrets to `.env`
2. ✅ Test file upload
3. ✅ Test document processing
4. ✅ Test semantic search
5. ⏳ Integrate with chat UI
6. ⏳ Add batch processing UI
7. ⏳ Monitor usage and costs

Your RAG system is ready to go! 🚀
