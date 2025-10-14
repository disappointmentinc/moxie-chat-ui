import { NextResponse } from "next/server";
import { storageDriver } from "lib/file-storage";
import { getSession } from "auth/server";

/**
 * Debug endpoint to check storage configuration
 * Only accessible to authenticated users
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const envVars = {
      FILE_STORAGE_TYPE: process.env.FILE_STORAGE_TYPE || "(not set)",
      CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID
        ? "✓ Set"
        : "✗ Not set",
      CLOUDFLARE_R2_ACCESS_KEY_ID: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID
        ? "✓ Set"
        : "✗ Not set",
      CLOUDFLARE_R2_SECRET_ACCESS_KEY: process.env
        .CLOUDFLARE_R2_SECRET_ACCESS_KEY
        ? "✓ Set"
        : "✗ Not set",
      CLOUDFLARE_R2_BUCKET_NAME: process.env.CLOUDFLARE_R2_BUCKET_NAME
        ? `✓ ${process.env.CLOUDFLARE_R2_BUCKET_NAME}`
        : "✗ Not set",
      CLOUDFLARE_R2_PUBLIC_DOMAIN: process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN
        ? `✓ ${process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN}`
        : "✗ Not set",
      BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN
        ? "✓ Set"
        : "✗ Not set",
    };

    return NextResponse.json({
      currentDriver: storageDriver,
      environmentVariables: envVars,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to check storage",
      },
      { status: 500 },
    );
  }
}
