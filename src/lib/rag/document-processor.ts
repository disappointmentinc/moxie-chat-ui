import "server-only";

import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import * as pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { serverFileStorage } from "lib/file-storage";
import { generateUUID } from "lib/utils";
import logger from "logger";

export interface ProcessedDocument {
  chunks: DocumentChunk[];
  metadata: {
    fileKey: string;
    filename: string;
    totalChunks: number;
    processedAt: Date;
  };
}

export interface DocumentChunk {
  id: string;
  text: string;
  metadata: {
    fileKey: string;
    filename: string;
    chunkIndex: number;
    pageNumber?: number;
  };
}

/**
 * Process a document from R2 storage and split it into chunks for RAG.
 * Supports PDF, DOCX, and text files.
 */
export async function processDocument(
  fileKey: string,
): Promise<ProcessedDocument> {
  logger.info(`Processing document: ${fileKey}`);

  // 1. Download file from R2
  const buffer = await serverFileStorage.download(fileKey);
  const metadata = await serverFileStorage.getMetadata(fileKey);

  if (!metadata) {
    throw new Error(`File not found: ${fileKey}`);
  }

  // 2. Extract text based on file type
  let text: string;

  try {
    if (metadata.contentType === "application/pdf") {
      logger.info(`Extracting text from PDF: ${fileKey}`);
      const pdfData = await (pdfParse as any).default(buffer);
      text = pdfData.text;
    } else if (
      metadata.contentType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      metadata.filename.endsWith(".docx")
    ) {
      logger.info(`Extracting text from DOCX: ${fileKey}`);
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (
      metadata.contentType.startsWith("text/") ||
      metadata.filename.endsWith(".txt") ||
      metadata.filename.endsWith(".md")
    ) {
      logger.info(`Reading text file: ${fileKey}`);
      text = buffer.toString("utf-8");
    } else {
      throw new Error(
        `Unsupported file type: ${metadata.contentType} (${metadata.filename})`,
      );
    }
  } catch (error) {
    logger.error(`Failed to extract text from ${fileKey}:`, error);
    throw new Error(
      `Failed to extract text from file: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }

  if (!text || text.trim().length === 0) {
    throw new Error(`No text content found in file: ${fileKey}`);
  }

  logger.info(`Extracted ${text.length} characters from ${fileKey}`);

  // 3. Split into chunks
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
    separators: ["\n\n", "\n", ". ", " ", ""],
  });

  const docs = await splitter.createDocuments([text]);
  logger.info(`Split document into ${docs.length} chunks`);

  // 4. Create chunks with metadata
  const chunks: DocumentChunk[] = docs.map((doc, index) => ({
    id: `${generateUUID()}`,
    text: doc.pageContent,
    metadata: {
      fileKey,
      filename: metadata.filename,
      chunkIndex: index,
    },
  }));

  return {
    chunks,
    metadata: {
      fileKey,
      filename: metadata.filename,
      totalChunks: chunks.length,
      processedAt: new Date(),
    },
  };
}

/**
 * Check if a file type is supported for RAG processing
 */
export function isSupportedFileType(
  contentType: string,
  filename: string,
): boolean {
  const supportedTypes = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/markdown",
  ];

  const supportedExtensions = [".pdf", ".docx", ".txt", ".md"];

  return (
    supportedTypes.includes(contentType) ||
    supportedExtensions.some((ext) => filename.toLowerCase().endsWith(ext))
  );
}
