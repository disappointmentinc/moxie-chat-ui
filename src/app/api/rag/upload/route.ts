import { NextResponse } from "next/server";
import { processDocument, isSupportedFileType } from "lib/rag/document-processor";
import { indexDocuments } from "lib/rag/vectorize-store";
import { serverFileStorage } from "lib/file-storage";
import { getSession } from "auth/server";
import logger from "logger";

/**
 * POST /api/rag/upload
 * Process a document from R2 and index it in Vectorize for RAG
 *
 * Request body:
 * {
 *   "fileKey": "uploads/uuid-document.pdf"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "metadata": {
 *     "fileKey": "uploads/uuid-document.pdf",
 *     "filename": "document.pdf",
 *     "totalChunks": 15,
 *     "processedAt": "2025-01-10T12:00:00.000Z"
 *   }
 * }
 */
export async function POST(request: Request) {
  try {
    // 1. Check authentication
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    // 2. Parse request body
    const body = await request.json();
    const { fileKey } = body;

    if (!fileKey || typeof fileKey !== "string") {
      return NextResponse.json(
        { error: "fileKey is required and must be a string" },
        { status: 400 },
      );
    }

    logger.info(`RAG upload request for file: ${fileKey} by user: ${session.user.id}`);

    // 3. Verify file exists in R2
    const exists = await serverFileStorage.exists(fileKey);
    if (!exists) {
      return NextResponse.json(
        { error: `File not found: ${fileKey}` },
        { status: 404 },
      );
    }

    // 4. Get file metadata and check if supported
    const metadata = await serverFileStorage.getMetadata(fileKey);
    if (!metadata) {
      return NextResponse.json(
        { error: `Could not retrieve metadata for file: ${fileKey}` },
        { status: 500 },
      );
    }

    if (!isSupportedFileType(metadata.contentType, metadata.filename)) {
      return NextResponse.json(
        {
          error: `Unsupported file type: ${metadata.contentType}. Supported: PDF, DOCX, TXT, MD`,
          contentType: metadata.contentType,
          filename: metadata.filename,
        },
        { status: 400 },
      );
    }

    // 5. Process document (extract text and chunk)
    logger.info(`Processing document: ${fileKey}`);
    const processed = await processDocument(fileKey);

    // 6. Index chunks in Vectorize
    logger.info(`Indexing ${processed.chunks.length} chunks for ${fileKey}`);
    await indexDocuments(processed.chunks);

    // 7. Return success response
    logger.info(`Successfully processed and indexed ${fileKey}`);
    return NextResponse.json({
      success: true,
      metadata: processed.metadata,
    });

  } catch (error) {
    logger.error("RAG upload error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      {
        error: "Failed to process document",
        details: errorMessage,
      },
      { status: 500 },
    );
  }
}
