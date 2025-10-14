import path from "node:path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { FileNotFoundError } from "lib/errors";
import type {
  FileMetadata,
  FileStorage,
  UploadOptions,
  UploadUrlOptions,
  UploadUrl,
} from "./file-storage.interface";
import {
  resolveStoragePrefix,
  sanitizeFilename,
  toBuffer,
  getContentTypeFromFilename,
} from "./storage-utils";
import { generateUUID } from "lib/utils";
import logger from "logger";

/**
 * Cloudflare R2 storage backend (S3-compatible).
 *
 * Configuration via environment variables:
 * - CLOUDFLARE_ACCOUNT_ID: Your Cloudflare account ID
 * - CLOUDFLARE_R2_ACCESS_KEY_ID: R2 access key ID
 * - CLOUDFLARE_R2_SECRET_ACCESS_KEY: R2 secret access key
 * - CLOUDFLARE_R2_BUCKET_NAME: Name of your R2 bucket
 * - CLOUDFLARE_R2_PUBLIC_DOMAIN: (Optional) Custom public domain for your bucket
 *   If not set, uses the default R2.dev domain
 * - FILE_STORAGE_PREFIX: (Optional) Subdirectory prefix for organizing files
 */
export const createS3FileStorage = (): FileStorage => {
  // Read environment variables at runtime, not at module load time
  const STORAGE_PREFIX = resolveStoragePrefix();
  const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
  const ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME;
  const PUBLIC_DOMAIN = process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN; // Optional custom domain

  if (!ACCOUNT_ID || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY || !BUCKET_NAME) {
    throw new Error(
      "Missing required Cloudflare R2 configuration. Please set: " +
        "CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID, " +
        "CLOUDFLARE_R2_SECRET_ACCESS_KEY, CLOUDFLARE_R2_BUCKET_NAME",
    );
  }

  // Cloudflare R2 endpoint
  const endpoint = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`;

  const client = new S3Client({
    region: "auto", // R2 doesn't use regions, but the SDK requires this
    endpoint,
    credentials: {
      accessKeyId: ACCESS_KEY_ID,
      secretAccessKey: SECRET_ACCESS_KEY,
    },
    forcePathStyle: true, // Required for R2 - uses path-style URLs instead of virtual-hosted-style
  });

  logger.info(
    `Initialized Cloudflare R2 storage: bucket=${BUCKET_NAME}, endpoint=${endpoint}`,
  );

  const buildKey = (filename: string) => {
    const safeName = sanitizeFilename(filename);
    const id = generateUUID();
    const prefix = STORAGE_PREFIX ? `${STORAGE_PREFIX}/` : "";
    return path.posix.join(prefix, `${id}-${safeName}`);
  };

  const getPublicUrl = (key: string) => {
    if (PUBLIC_DOMAIN) {
      // Use custom public domain if configured
      return `https://${PUBLIC_DOMAIN}/${key}`;
    }
    // Use default R2.dev public domain
    // Note: You need to enable public access on your bucket
    // and note the public URL format from Cloudflare dashboard
    return `https://pub-${BUCKET_NAME}.r2.dev/${key}`;
  };

  const mapMetadata = (
    key: string,
    info: {
      ContentType?: string;
      ContentLength?: number;
      LastModified?: Date;
    },
  ): FileMetadata => ({
    key,
    filename: path.posix.basename(key),
    contentType: info.ContentType || "application/octet-stream",
    size: info.ContentLength || 0,
    uploadedAt: info.LastModified,
  });

  return {
    async upload(content, options: UploadOptions = {}) {
      const buffer = await toBuffer(content);
      const filename = options.filename ?? "file";
      const key = buildKey(filename);

      const contentType =
        options.contentType || getContentTypeFromFilename(filename);

      await client.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        }),
      );

      const metadata: FileMetadata = {
        key,
        filename: path.posix.basename(key),
        contentType,
        size: buffer.byteLength,
        uploadedAt: new Date(),
      };

      return {
        key,
        sourceUrl: getPublicUrl(key),
        metadata,
      };
    },

    async createUploadUrl(options: UploadUrlOptions): Promise<UploadUrl> {
      const key = buildKey(options.filename);
      const expiresIn = options.expiresInSeconds || 3600; // 1 hour default

      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        ContentType: options.contentType,
      });

      const url = await getSignedUrl(client, command, {
        expiresIn,
      });

      return {
        key,
        url,
        publicUrl: getPublicUrl(key), // Add public URL for client
        method: "PUT",
        expiresAt: new Date(Date.now() + expiresIn * 1000),
        headers: {
          "Content-Type": options.contentType,
        },
      };
    },

    async download(key) {
      try {
        const command = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
        });

        const response = await client.send(command);

        if (!response.Body) {
          throw new FileNotFoundError(key);
        }

        // Convert stream to buffer
        const chunks: Uint8Array[] = [];
        for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
          chunks.push(chunk);
        }

        return Buffer.concat(chunks);
      } catch (error: any) {
        if (error.name === "NoSuchKey" || error.$metadata?.httpStatusCode === 404) {
          throw new FileNotFoundError(key, error);
        }
        throw error;
      }
    },

    async delete(key) {
      await client.send(
        new DeleteObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
        }),
      );
    },

    async exists(key) {
      try {
        await client.send(
          new HeadObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
          }),
        );
        return true;
      } catch (error: any) {
        if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
          return false;
        }
        throw error;
      }
    },

    async getMetadata(key) {
      try {
        const response = await client.send(
          new HeadObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
          }),
        );

        return mapMetadata(key, {
          ContentType: response.ContentType,
          ContentLength: response.ContentLength,
          LastModified: response.LastModified,
        });
      } catch (error: any) {
        if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
          return null;
        }
        throw error;
      }
    },

    async getSourceUrl(key) {
      const exists = await this.exists(key);
      return exists ? getPublicUrl(key) : null;
    },

    async getDownloadUrl(key) {
      try {
        const command = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
        });

        // Generate presigned download URL valid for 1 hour
        const url = await getSignedUrl(client, command, {
          expiresIn: 3600,
        });

        return url;
      } catch (error: any) {
        if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
          return null;
        }
        throw error;
      }
    },
  } satisfies FileStorage;
};
