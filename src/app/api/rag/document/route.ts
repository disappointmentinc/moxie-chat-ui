import { NextResponse } from "next/server";
import { deleteVectorsByFileKey } from "lib/rag/vectorize-store";
import { auth } from "lib/auth";
import logger from "logger";

/**
 * DELETE /api/rag/document
 * Remove a document's vectors from Vectorize
 *
 * Request body:
 * {
 *   "fileKey": "uploads/uuid-document.pdf"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Document vectors deleted successfully"
 * }
 */
export async function DELETE(request: Request) {
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
    const { fileKey } = body;

    if (!fileKey || typeof fileKey !== "string") {
      return NextResponse.json(
        { error: "fileKey is required and must be a string" },
        { status: 400 },
      );
    }

    logger.info(`RAG delete request for file: ${fileKey} by user: ${session.user.id}`);

    // 3. Delete vectors from Vectorize
    await deleteVectorsByFileKey(fileKey);

    // 4. Return success response
    logger.info(`Successfully deleted vectors for ${fileKey}`);
    return NextResponse.json({
      success: true,
      message: "Document vectors deleted successfully",
    });

  } catch (error) {
    logger.error("RAG delete error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      {
        error: "Failed to delete document vectors",
        details: errorMessage,
      },
      { status: 500 },
    );
  }
}
