import "server-only";

import type { DocumentChunk } from "./document-processor";
import { generateEmbeddings, generateQueryEmbedding } from "./embeddings";
import logger from "logger";

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const INDEX_NAME = process.env.VECTORIZE_INDEX_ID || "rag-slides-index";

if (!ACCOUNT_ID) {
  throw new Error(
    "CLOUDFLARE_ACCOUNT_ID is required. Please set it in your .env file.",
  );
}

if (!API_TOKEN) {
  throw new Error(
    "CLOUDFLARE_API_TOKEN is required. Please set it in your .env file.",
  );
}

interface VectorizeVector {
  id: string;
  values: number[];
  metadata: Record<string, any>;
}

interface VectorizeMatch {
  id: string;
  score: number;
  metadata: Record<string, any>;
}

/**
 * Index document chunks in Cloudflare Vectorize
 * Generates embeddings and stores them with metadata
 */
export async function indexDocuments(
  chunks: DocumentChunk[],
): Promise<void> {
  if (chunks.length === 0) {
    logger.info("No chunks to index");
    return;
  }

  logger.info(`Indexing ${chunks.length} document chunks in Vectorize`);

  try {
    // Generate embeddings for all chunks
    const texts = chunks.map((c) => c.text);
    const embeddings = await generateEmbeddings(texts);

    // Prepare vectors with metadata
    const vectors: VectorizeVector[] = chunks.map((chunk, i) => ({
      id: chunk.id,
      values: embeddings[i],
      metadata: {
        text: chunk.text,
        fileKey: chunk.metadata.fileKey,
        filename: chunk.metadata.filename,
        chunkIndex: chunk.metadata.chunkIndex,
      },
    }));

    // Insert vectors into Vectorize
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/vectorize/indexes/${INDEX_NAME}/insert`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ vectors }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Vectorize API error (${response.status}): ${errorText}`,
      );
    }

    const result = await response.json();
    logger.info(
      `Successfully indexed ${vectors.length} vectors in Vectorize`,
      result,
    );
  } catch (error) {
    logger.error("Failed to index documents in Vectorize:", error);
    throw new Error(
      `Failed to index documents: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Search for relevant documents using semantic similarity
 * Returns ranked results with scores
 */
export async function searchDocuments(
  query: string,
  topK: number = 5,
  filter?: Record<string, any>,
): Promise<Array<DocumentChunk & { score: number }>> {
  if (!query || query.trim().length === 0) {
    throw new Error("Query cannot be empty");
  }

  logger.info(`Searching Vectorize for: "${query}" (topK: ${topK})`);

  try {
    // Generate query embedding
    const queryEmbedding = await generateQueryEmbedding(query);

    // Query Vectorize
    const requestBody: any = {
      vector: queryEmbedding,
      topK,
      returnMetadata: "all",
    };

    if (filter) {
      requestBody.filter = filter;
    }

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/vectorize/indexes/${INDEX_NAME}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Vectorize query error (${response.status}): ${errorText}`,
      );
    }

    const data = await response.json();
    const matches: VectorizeMatch[] = data.result?.matches || [];

    logger.info(`Found ${matches.length} matches in Vectorize`);

    // Convert Vectorize matches to DocumentChunks
    const results = matches.map((match) => ({
      id: match.id,
      text: match.metadata.text,
      metadata: {
        fileKey: match.metadata.fileKey,
        filename: match.metadata.filename,
        chunkIndex: match.metadata.chunkIndex,
      },
      score: match.score,
    }));

    return results;
  } catch (error) {
    logger.error("Failed to search Vectorize:", error);
    throw new Error(
      `Failed to search documents: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Delete vectors from Vectorize by IDs
 */
export async function deleteVectorsByIds(ids: string[]): Promise<void> {
  if (ids.length === 0) {
    logger.info("No vectors to delete");
    return;
  }

  logger.info(`Deleting ${ids.length} vectors from Vectorize`);

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/vectorize/indexes/${INDEX_NAME}/delete`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Vectorize delete error (${response.status}): ${errorText}`,
      );
    }

    logger.info(`Successfully deleted ${ids.length} vectors`);
  } catch (error) {
    logger.error("Failed to delete vectors:", error);
    throw new Error(
      `Failed to delete vectors: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Delete all vectors associated with a file
 */
export async function deleteVectorsByFileKey(fileKey: string): Promise<void> {
  logger.info(`Deleting vectors for file: ${fileKey}`);

  try {
    // Query all vectors for this file
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/vectorize/indexes/${INDEX_NAME}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vector: new Array(1536).fill(0), // Dummy vector
          topK: 1000, // Get all chunks for this file
          returnMetadata: "all",
          filter: { fileKey },
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Vectorize query error (${response.status}): ${errorText}`,
      );
    }

    const data = await response.json();
    const matches: VectorizeMatch[] = data.result?.matches || [];
    const ids = matches.map((m) => m.id);

    if (ids.length > 0) {
      await deleteVectorsByIds(ids);
      logger.info(`Deleted ${ids.length} vectors for file ${fileKey}`);
    } else {
      logger.info(`No vectors found for file ${fileKey}`);
    }
  } catch (error) {
    logger.error(`Failed to delete vectors for file ${fileKey}:`, error);
    throw new Error(
      `Failed to delete vectors for file: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
