import "server-only";

import { OpenAIEmbeddings } from "@langchain/openai";
import logger from "logger";

const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL || "text-embedding-3-small";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  throw new Error(
    "OPENAI_API_KEY is required for embeddings. Please set it in your .env file.",
  );
}

const embeddings = new OpenAIEmbeddings({
  modelName: EMBEDDING_MODEL,
  openAIApiKey: OPENAI_API_KEY,
});

/**
 * Generate embeddings for multiple text chunks
 * Returns array of embedding vectors (number arrays)
 */
export async function generateEmbeddings(
  texts: string[],
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  logger.info(
    `Generating embeddings for ${texts.length} texts using ${EMBEDDING_MODEL}`,
  );

  try {
    const results = await embeddings.embedDocuments(texts);
    logger.info(`Successfully generated ${results.length} embeddings`);
    return results;
  } catch (error) {
    logger.error("Failed to generate embeddings:", error);
    throw new Error(
      `Failed to generate embeddings: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Generate embedding for a single query text
 * Returns embedding vector (number array)
 */
export async function generateQueryEmbedding(
  query: string,
): Promise<number[]> {
  if (!query || query.trim().length === 0) {
    throw new Error("Query text cannot be empty");
  }

  logger.info(`Generating query embedding using ${EMBEDDING_MODEL}`);

  try {
    const result = await embeddings.embedQuery(query);
    logger.info("Successfully generated query embedding");
    return result;
  } catch (error) {
    logger.error("Failed to generate query embedding:", error);
    throw new Error(
      `Failed to generate query embedding: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Get the dimension size for the current embedding model
 * - text-embedding-3-small: 1536 dimensions
 * - text-embedding-3-large: 3072 dimensions
 * - text-embedding-ada-002: 1536 dimensions
 */
export function getEmbeddingDimensions(): number {
  switch (EMBEDDING_MODEL) {
    case "text-embedding-3-large":
      return 3072;
    case "text-embedding-3-small":
    case "text-embedding-ada-002":
    default:
      return 1536;
  }
}

export { EMBEDDING_MODEL };
