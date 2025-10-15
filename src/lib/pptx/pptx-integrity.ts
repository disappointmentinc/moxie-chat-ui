import JSZip from "jszip";
import logger from "logger";
import { loadWhiteLogoAsJpeg } from "./brand-assets";

const LOGO_TARGET = "ppt/media/image2.jpg";
const THEME_TARGET = "ppt/theme/theme1.xml";

export async function verifyPPTXIntegrity(
  buffer: Buffer,
  expectedSlideCount: number,
): Promise<void> {
  const zip = await JSZip.loadAsync(buffer);

  await verifySlideCount(zip, expectedSlideCount);
  await verifyTheme(zip);
  await verifyLogo(zip);
}

async function verifySlideCount(zip: JSZip, expected: number) {
  const slideFiles = Object.keys(zip.files).filter((name) =>
    /^ppt\/slides\/slide\d+\.xml$/.test(name),
  );

  if (slideFiles.length !== expected) {
    throw new Error(
      `PPTX integrity check failed: expected ${expected} slides, found ${slideFiles.length}.`,
    );
  }
}

async function verifyTheme(zip: JSZip) {
  const themeFile = zip.file(THEME_TARGET);
  if (!themeFile) {
    throw new Error("PPTX integrity check failed: theme1.xml missing.");
  }

  const themeXml = await themeFile.async("string");
  if (!themeXml.includes("HEALTHRISE")) {
    throw new Error("PPTX integrity check failed: Healthrise theme not applied.");
  }
}

async function verifyLogo(zip: JSZip) {
  const expectedLogo = await loadWhiteLogoAsJpeg();
  if (!expectedLogo) {
    logger.warn("Skipped logo integrity check because white logo asset is unavailable.");
    return;
  }

  const logoEntry = zip.file(LOGO_TARGET);
  if (!logoEntry) {
    throw new Error(`PPTX integrity check failed: ${LOGO_TARGET} missing.`);
  }

  const logoBuffer = await logoEntry.async("nodebuffer");
  if (!logoBuffer.equals(expectedLogo)) {
    throw new Error("PPTX integrity check failed: embedded logo does not match white brand asset.");
  }
}
