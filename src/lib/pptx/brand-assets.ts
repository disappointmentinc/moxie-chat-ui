import fs from "fs/promises";
import path from "path";
import logger from "logger";

let cachedWhiteLogo: Buffer | null = null;

const WHITE_LOGO_CANDIDATES = [
  path.join(process.cwd(), ".yak", "Healthrise_Logo copy.webp"),
  path.join(process.cwd(), "public", "Healthrise logo WHITE.webp"),
  path.join(process.cwd(), "public", "healthrise-logo.png"),
];

/**
 * Load the white Healthrise logo from disk and normalize it to a JPEG buffer.
 * The template expects a JPEG in ppt/media/image2.jpg, so we convert anything else.
 */
export async function loadWhiteLogoAsJpeg(): Promise<Buffer | null> {
  if (cachedWhiteLogo) {
    return cachedWhiteLogo;
  }

  let sourcePath: string | null = null;
  for (const candidate of WHITE_LOGO_CANDIDATES) {
    try {
      await fs.access(candidate);
      sourcePath = candidate;
      break;
    } catch {
      continue;
    }
  }

  if (!sourcePath) {
    logger.warn("White logo asset not found in .yak or public directories.");
    return null;
  }

  try {
    const { default: sharp } = await import("sharp");
    const fileBuffer = await fs.readFile(sourcePath);
    cachedWhiteLogo = await sharp(fileBuffer)
      .jpeg({ quality: 92, progressive: true })
      .toBuffer();
    logger.info(`Loaded white logo from ${path.relative(process.cwd(), sourcePath)}`);
    return cachedWhiteLogo;
  } catch (error) {
    logger.error("Failed to normalize white logo asset:", error);
    return null;
  }
}
