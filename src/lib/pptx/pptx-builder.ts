import "server-only";

import pptxgen from "pptxgenjs";
import logger from "logger";

export interface PresentationSlide {
  title: string;
  content: string[];
  notes?: string;
}

export interface PresentationData {
  title: string;
  subtitle?: string;
  author?: string;
  slides: PresentationSlide[];
}

export interface GeneratePPTXOptions {
  theme?: "light" | "dark" | "healthrise";
  includeFooter?: boolean;
}

/**
 * Generate a PPTX file from structured presentation data
 */
export async function generatePPTX(
  data: PresentationData,
  options: GeneratePPTXOptions = {},
): Promise<Buffer> {
  const { theme = "healthrise", includeFooter = true } = options;

  logger.info(
    `Generating PPTX: ${data.title} with ${data.slides.length} slides`,
  );

  const pptx = new pptxgen();

  // Configure presentation metadata
  pptx.author = data.author || "Healthrise Velocity";
  pptx.company = "Healthrise";
  pptx.subject = data.title;
  pptx.title = data.title;

  // Define theme colors and styles - Extracted from actual Healthrise branded slides
  const themes = {
    healthrise: {
      primary: "101D41", // Dark Navy Blue (from actual Healthrise theme)
      secondary: "92B2BB", // Muted Blue-Gray
      text: "333333",
      background: "FFFFFF",
      accent: "FBB03B", // Golden/Orange Yellow
      teal: "205956", // Teal accent
      lightMint: "CDEAE3", // Light Mint
      lightGray: "E7F0F1", // Very Light Blue-Gray
    },
    light: {
      primary: "4A90E2",
      secondary: "7B68EE",
      text: "333333",
      background: "FFFFFF",
      accent: "50C878",
    },
    dark: {
      primary: "61DAFB",
      secondary: "BB86FC",
      text: "E0E0E0",
      background: "1E1E1E",
      accent: "03DAC6",
    },
  };

  const colors = themes[theme];

  // Define master layout
  pptx.defineLayout({
    name: "CUSTOM_LAYOUT",
    width: 10,
    height: 5.625,
  });
  pptx.layout = "CUSTOM_LAYOUT";

  // Slide 1: Title slide
  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: colors.background };

  // Add decorative shape
  titleSlide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: "100%",
    h: 0.5,
    fill: { color: colors.primary },
  });

  // Title
  titleSlide.addText(data.title, {
    x: 0.5,
    y: 1.5,
    w: 9,
    h: 1.5,
    fontSize: 44,
    bold: false,
    fontFace: "Calibri Light",
    color: colors.primary,
    align: "center",
    valign: "middle",
  });

  // Subtitle
  if (data.subtitle) {
    titleSlide.addText(data.subtitle, {
      x: 0.5,
      y: 3,
      w: 9,
      h: 0.5,
      fontSize: 24,
      fontFace: "Calibri",
      color: colors.secondary,
      align: "center",
      valign: "middle",
    });
  }

  // Author/Date footer
  if (includeFooter) {
    const dateStr = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    titleSlide.addText(`${data.author || "Healthrise Velocity"} • ${dateStr}`, {
      x: 0.5,
      y: 5,
      w: 9,
      h: 0.3,
      fontSize: 12,
      fontFace: "Calibri",
      color: colors.secondary,
      align: "center",
      valign: "bottom",
    });
  }

  // Content slides
  data.slides.forEach((slideData, index) => {
    const slide = pptx.addSlide();
    slide.background = { color: colors.background };

    // Header bar
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: "100%",
      h: 0.5,
      fill: { color: colors.primary },
    });

    // Slide title
    slide.addText(slideData.title, {
      x: 0.5,
      y: 0.7,
      w: 9,
      h: 0.6,
      fontSize: 32,
      bold: false,
      fontFace: "Calibri Light",
      color: colors.primary,
    });

    // Content - bullet points
    if (slideData.content.length > 0) {
      const bulletText = slideData.content
        .map((point, idx) => `${idx + 1}. ${point}`)
        .join("\n\n");

      slide.addText(bulletText, {
        x: 0.7,
        y: 1.5,
        w: 8.6,
        h: 3.5,
        fontSize: 18,
        fontFace: "Calibri",
        color: colors.text,
        valign: "top",
        lineSpacing: 28,
      });
    }

    // Footer with slide number
    if (includeFooter) {
      slide.addText(`Slide ${index + 1} of ${data.slides.length}`, {
        x: 8.5,
        y: 5.2,
        w: 1.3,
        h: 0.3,
        fontSize: 10,
        fontFace: "Calibri",
        color: colors.secondary,
        align: "right",
      });
    }

    // Add speaker notes if provided
    if (slideData.notes) {
      slide.addNotes(slideData.notes);
    }
  });

  // Generate PPTX as buffer
  const buffer = (await pptx.write({
    outputType: "nodebuffer",
    compression: true,
  })) as Buffer;

  logger.info(`Successfully generated PPTX: ${buffer.length} bytes`);

  return buffer;
}

/**
 * Validate presentation data structure
 */
export function validatePresentationData(
  data: any,
): data is PresentationData {
  if (!data || typeof data !== "object") return false;
  if (typeof data.title !== "string" || data.title.trim().length === 0)
    return false;
  if (!Array.isArray(data.slides)) return false;

  for (const slide of data.slides) {
    if (typeof slide.title !== "string" || slide.title.trim().length === 0)
      return false;
    if (!Array.isArray(slide.content)) return false;
    if (!slide.content.every((item: any) => typeof item === "string"))
      return false;
  }

  return true;
}
