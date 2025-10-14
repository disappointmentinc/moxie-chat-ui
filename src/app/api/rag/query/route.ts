import { NextResponse } from "next/server";
import { searchDocuments } from "lib/rag/vectorize-store";
import { auth } from "lib/auth";
import logger from "logger";

/**
 * POST /api/rag/query
 * Search for relevant documents using semantic similarity
 *
 * Request body:
 * {
 *   "query": "What is denials prevention?",
 *   "topK": 5 (optional, default: 5),
 *   "filter": { "filename": "document.pdf" } (optional)
 * }
 *
 * Response:
 * {
 *   "results": [
 *     {
 *       "id": "chunk-uuid",
 *       "text": "Relevant text chunk...",
 *       "metadata": {
 *         "fileKey": "uploads/uuid-document.pdf",
 *         "filename": "document.pdf",
 *         "chunkIndex": 3
 *       },
 *       "score": 0.85
 *     }
 *   ],
 *   "count": 5
 * }
 */
export async function POST(request: Request) {
  try {
    // 1. Check authentication
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    // 2. Parse request body
    const body = await request.json();
    const { query, topK = 5, filter } = body;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return NextResponse.json(
        { error: "query is required and must be a non-empty string" },
        { status: 400 },
      );
    }

    if (typeof topK !== "number" || topK < 1 || topK > 100) {
      return NextResponse.json(
        { error: "topK must be a number between 1 and 100" },
        { status: 400 },
      );
    }

    logger.info(`RAG query: "${query}" (topK: ${topK}) by user: ${session.user.id}`);

    // 3. Search Vectorize
    const results = await searchDocuments(query, topK, filter);

    // 4. Return results
    logger.info(`Found ${results.length} results for query: "${query}"`);
    return NextResponse.json({
      results,
      count: results.length,
    });

  } catch (error) {
    logger.error("RAG query error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      {
        error: "Failed to search documents",
        details: errorMessage,
      },
      { status: 500 },
    );
  }
}
