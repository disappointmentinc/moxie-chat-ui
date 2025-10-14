"use server";

import { storageDriver } from "lib/file-storage";
import { IS_VERCEL_ENV } from "lib/const";

/**
 * Get storage configuration info.
 * Used by clients to determine upload strategy.
 */
export async function getStorageInfoAction() {
  return {
    type: storageDriver,
    supportsDirectUpload:
      storageDriver === "vercel-blob" || storageDriver === "s3",
  };
}

interface StorageCheckResult {
  isValid: boolean;
  error?: string;
  solution?: string;
}

/**
 * Check if storage is properly configured.
 * Returns detailed error messages with solutions.
 */
export async function checkStorageAction(): Promise<StorageCheckResult> {
  // 1. Check Vercel Blob configuration
  if (storageDriver === "vercel-blob") {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return {
        isValid: false,
        error: "BLOB_READ_WRITE_TOKEN is not set",
        solution:
          "Please add Vercel Blob to your project:\n" +
          "1. Go to your Vercel Dashboard\n" +
          "2. Navigate to Storage tab\n" +
          "3. Create a new Blob Store\n" +
          "4. Connect it to your project\n" +
          (IS_VERCEL_ENV
            ? "5. Redeploy your application"
            : "5. Run 'vercel env pull' to get the token locally"),
      };
    }
  }

  // 2. Check S3/R2 configuration
  if (storageDriver === "s3") {
    const requiredEnvVars = [
      "CLOUDFLARE_ACCOUNT_ID",
      "CLOUDFLARE_R2_ACCESS_KEY_ID",
      "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
      "CLOUDFLARE_R2_BUCKET_NAME",
    ];

    const missingVars = requiredEnvVars.filter(
      (varName) => !process.env[varName],
    );

    if (missingVars.length > 0) {
      return {
        isValid: false,
        error: `Missing required Cloudflare R2 configuration: ${missingVars.join(", ")}`,
        solution:
          "Please configure Cloudflare R2 in your environment:\n" +
          "1. Create an R2 bucket in Cloudflare Dashboard\n" +
          "2. Generate API credentials (Access Key + Secret Key)\n" +
          "3. Add the following to your .env.local:\n" +
          "   FILE_STORAGE_TYPE=s3\n" +
          "   CLOUDFLARE_ACCOUNT_ID=your_account_id\n" +
          "   CLOUDFLARE_R2_ACCESS_KEY_ID=your_access_key\n" +
          "   CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_secret_key\n" +
          "   CLOUDFLARE_R2_BUCKET_NAME=your_bucket_name\n" +
          "   CLOUDFLARE_R2_PUBLIC_DOMAIN=your_public_domain\n\n" +
          "See docs/tips-guides/cloudflare-r2-setup.md for detailed instructions",
      };
    }
  }

  // 3. Validate storage driver
  if (!["vercel-blob", "s3"].includes(storageDriver)) {
    return {
      isValid: false,
      error: `Invalid storage driver: ${storageDriver}`,
      solution:
        "FILE_STORAGE_TYPE must be one of:\n" +
        "- 'vercel-blob' (default)\n" +
        "- 's3' (coming soon)",
    };
  }

  return {
    isValid: true,
  };
}
