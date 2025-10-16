import fs from "fs/promises";
import path from "path";
import logger from "logger";

interface LogoCache {
  healthrise: Buffer | null;
  light: Buffer | null;
  dark: Buffer | null;
}

const cachedLogos: LogoCache = {
  healthrise: null,
  light: null,
  dark: null,
};

const LOGO_CANDIDATES = [
  path.join(process.cwd(), "public", "Healthrise logo WHITE.webp"),
  path.join(process.cwd(), ".yak", "Healthrise_Logo copy.webp"),
  path.join(process.cwd(), "public", "healthrise-logo.png"),
];

type ThemeType = "healthrise" | "light" | "dark";

/**
 * Load the white Healthrise logo from disk and normalize it to a JPEG buffer.
 * The template expects a JPEG in ppt/media/image2.jpg, so we convert anything else.
 *
 * @param theme - The theme to use for background color selection
 */
export async function loadWhiteLogoAsJpeg(
  theme: ThemeType = "healthrise",
): Promise<Buffer | null> {
  if (cachedLogos[theme]) {
    return cachedLogos[theme];
  }

  let sourcePath: string | null = null;
  for (const candidate of LOGO_CANDIDATES) {
    try {
      await fs.access(candidate);
      sourcePath = candidate;
      break;
    } catch {
      continue;
    }
  }

  if (!sourcePath) {
    logger.warn("Logo asset not found in .yak or public directories.");
    return null;
  }

  try {
    const { default: sharp } = await import("sharp");
    const fileBuffer = await fs.readFile(sourcePath);

    // Use dark background for white logo (used on title page and footer)
    const backgroundColor = "#0f1d42";

    // Get image metadata to check if it has transparency
    const metadata = await sharp(fileBuffer).metadata();

    let sharpInstance = sharp(fileBuffer);

    // Only flatten if the image has an alpha channel
    if (metadata.hasAlpha) {
      sharpInstance = sharpInstance.flatten({ background: backgroundColor });
    }

    // Convert to JPEG with high quality
    const logoBuffer = await sharpInstance
      .jpeg({ quality: 95, progressive: true, force: true })
      .toBuffer();

    cachedLogos[theme] = logoBuffer;
    logger.info(`Loaded ${theme} WHITE logo from ${path.relative(process.cwd(), sourcePath)} (${metadata.format} -> JPEG) with dark background`);
    return logoBuffer;
  } catch (error) {
    logger.error(`Failed to normalize logo asset for ${theme} theme:`, error);
    return null;
  }
}

/**
 * Clear the logo cache to force reload on next request
 */
export function clearLogoCache(): void {
  cachedLogos.healthrise = null;
  cachedLogos.light = null;
  cachedLogos.dark = null;
}
