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
      lightGray: "F5F5F5",
    },
    dark: {
      primary: "61DAFB",
      secondary: "BB86FC",
      text: "E0E0E0",
      background: "1E1E1E",
      accent: "03DAC6",
      lightGray: "2A2A2A",
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

  // Slide 1: Title slide with Healthrise branding
  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: colors.background };

  // Top accent bar (Healthrise branded)
  titleSlide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: "100%",
    h: 0.4,
    fill: { color: colors.primary },
  });

  // Accent stripe on the side (golden yellow)
  titleSlide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0.4,
    w: 0.15,
    h: 5.225,
    fill: { color: colors.accent },
  });

  // Main title area with background
  titleSlide.addShape(pptx.ShapeType.rect, {
    x: 0.5,
    y: 1.2,
    w: 9,
    h: 2.5,
    fill: { type: "solid", color: colors.lightGray, transparency: 30 },
    line: { type: "none" },
  });

  // Title
  titleSlide.addText(data.title, {
    x: 0.8,
    y: 1.5,
    w: 8.5,
    h: 1.2,
    fontSize: 48,
    bold: false,
    fontFace: "Calibri Light",
    color: colors.primary,
    align: "left",
    valign: "middle",
  });

  // Subtitle
  if (data.subtitle) {
    titleSlide.addText(data.subtitle, {
      x: 0.8,
      y: 2.8,
      w: 8.5,
      h: 0.6,
      fontSize: 22,
      fontFace: "Calibri",
      color: colors.secondary,
      align: "left",
      valign: "middle",
    });
  }

  // Healthrise logo (bottom right)
  try {
    titleSlide.addImage({
      path: "public/healthrise-logo.png",
      x: 7.5,
      y: 4.5,
      w: 2,
      h: 0.8,
    });
  } catch (error) {
    logger.warn("Logo not found, skipping logo insertion");
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
      y: 5.1,
      w: 6.5,
      h: 0.3,
      fontSize: 11,
      fontFace: "Calibri",
      color: colors.secondary,
      align: "left",
      valign: "bottom",
    });
  }

  // Content slides with branded template
  data.slides.forEach((slideData, index) => {
    const slide = pptx.addSlide();
    slide.background = { color: colors.background };

    // Top accent bar
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: "100%",
      h: 0.4,
      fill: { color: colors.primary },
    });

    // Side accent stripe (golden yellow)
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0.4,
      w: 0.08,
      h: 5.225,
      fill: { color: colors.accent },
    });

    // Slide title with subtle background
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.3,
      y: 0.6,
      w: 9.4,
      h: 0.7,
      fill: { type: "solid", color: colors.lightGray, transparency: 50 },
      line: { type: "none" },
    });

    slide.addText(slideData.title, {
      x: 0.5,
      y: 0.65,
      w: 9,
      h: 0.6,
      fontSize: 28,
      bold: false,
      fontFace: "Calibri Light",
      color: colors.primary,
      align: "left",
      valign: "middle",
    });

    // Content - styled bullet points
    if (slideData.content.length > 0) {
      // Add bullet points with custom styling
      slideData.content.forEach((point, idx) => {
        // Bullet number circle
        slide.addShape(pptx.ShapeType.ellipse, {
          x: 0.5,
          y: 1.6 + (idx * 0.7),
          w: 0.3,
          h: 0.3,
          fill: { color: colors.accent },
          line: { type: "none" },
        });

        // Bullet number
        slide.addText(`${idx + 1}`, {
          x: 0.5,
          y: 1.6 + (idx * 0.7),
          w: 0.3,
          h: 0.3,
          fontSize: 14,
          bold: true,
          fontFace: "Calibri",
          color: "FFFFFF",
          align: "center",
          valign: "middle",
        });

        // Bullet text
        slide.addText(point, {
          x: 1.0,
          y: 1.55 + (idx * 0.7),
          w: 8.5,
          h: 0.6,
          fontSize: 16,
          fontFace: "Calibri",
          color: colors.text,
          valign: "top",
        });
      });
    }

    // Healthrise logo (small, bottom right)
    try {
      slide.addImage({
        path: "public/healthrise-logo.png",
        x: 8.5,
        y: 5,
        w: 1.2,
        h: 0.4,
        sizing: { type: "contain", w: 1.2, h: 0.4 },
      });
    } catch (error) {
      // Logo not found, skip silently
    }

    // Footer with slide number
    if (includeFooter) {
      slide.addText(`${index + 1} / ${data.slides.length}`, {
        x: 0.3,
        y: 5.15,
        w: 1,
        h: 0.3,
        fontSize: 10,
        fontFace: "Calibri",
        color: colors.secondary,
        align: "left",
      });
    }

    // Add speaker notes with source citations if provided
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
