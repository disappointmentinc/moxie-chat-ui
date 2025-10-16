import "server-only";

import pptxgen from "pptxgenjs";
import type { TextProps } from "pptxgenjs";
import logger from "logger";
import { generatePPTXFromTemplate } from "./pptx-template-builder-v2";

export type SlideLayoutType =
  | "section-break"
  | "bullets"
  | "two-column"
  | "kpi-grid"
  | "quote"
  | "comparison"
  | "timeline";

interface BaseSlide {
  id?: string;
  layout: SlideLayoutType;
  title: string;
  eyebrow?: string;
  notes?: string;
}

export interface SectionBreakSlide extends BaseSlide {
  layout: "section-break";
  description?: string;
  highlights?: string[];
}

export interface BulletSlide extends BaseSlide {
  layout: "bullets";
  bullets: string[];
  supportingPoints?: string[];
  kickerLeft?: string;
  kickerRight?: string;
}

export interface TwoColumnSlide extends BaseSlide {
  layout: "two-column";
  leftColumn: string[];
  rightColumn: string[];
  rightTitle?: string;
}

export interface KpiMetric {
  label: string;
  value: string;
  delta?: string;
  description?: string;
}

export interface KpiGridSlide extends BaseSlide {
  layout: "kpi-grid";
  summary?: string;
  metrics: KpiMetric[];
  footnotes?: string[];
}

export interface QuoteSlide extends BaseSlide {
  layout: "quote";
  quote: string;
  attribution?: string;
  supportingPoints?: string[];
}

export interface ComparisonColumn {
  title: string;
  bullets: string[];
}

export interface ComparisonSlide extends BaseSlide {
  layout: "comparison";
  summary?: string;
  tableTitle?: string;
  columns: ComparisonColumn[];
  footnotes?: string[];
}

export interface TimelineMilestone {
  title: string;
  date?: string;
  description?: string;
}

export interface TimelineSlide extends BaseSlide {
  layout: "timeline";
  summary?: string;
  milestones: TimelineMilestone[];
  footnotes?: string[];
}

export type PresentationSlide =
  | SectionBreakSlide
  | BulletSlide
  | TwoColumnSlide
  | KpiGridSlide
  | QuoteSlide
  | ComparisonSlide
  | TimelineSlide;

export interface PresentationData {
  title: string;
  subtitle?: string;
  author?: string;
  slides: PresentationSlide[];
}

export interface GeneratePPTXOptions {
  theme?: "light" | "dark" | "healthrise";
  includeFooter?: boolean;
  useTemplate?: boolean; // Use template__Comp.pptx as base (default: true)
}

const FALLBACK_THEMES = {
  healthrise: {
    primary: "101D41",
    accent: "FBB03B",
    text: "333333",
    muted: "92B2BB",
    background: "FFFFFF",
    panel: "E7F0F1",
  },
  light: {
    primary: "4A90E2",
    accent: "50C878",
    text: "333333",
    muted: "7B68EE",
    background: "FFFFFF",
    panel: "F5F5F5",
  },
  dark: {
    primary: "61DAFB",
    accent: "03DAC6",
    text: "E0E0E0",
    muted: "BB86FC",
    background: "1E1E1E",
    panel: "2A2A2A",
  },
} as const satisfies Record<
  Required<GeneratePPTXOptions>["theme"],
  {
    primary: string;
    accent: string;
    text: string;
    muted: string;
    background: string;
    panel: string;
  }
>;

/**
 * Generate a PPTX file from structured presentation data
 */
export async function generatePPTX(
  data: PresentationData,
  options: GeneratePPTXOptions = {},
): Promise<Buffer> {
  const {
    theme = "healthrise",
    includeFooter = true,
    useTemplate = true,
  } = options;

  if (useTemplate) {
    logger.info(
      `Generating PPTX from template: ${data.title} with ${data.slides.length} slides`,
    );
    return generatePPTXFromTemplate(data, { theme, includeFooter });
  }

  logger.warn(
    "Template generation disabled – falling back to simplified PPTX rendering.",
  );

  const themePalette =
    FALLBACK_THEMES[theme] ?? FALLBACK_THEMES.healthrise;

  const pptx = new pptxgen();
  pptx.author = data.author || "Healthrise Velocity";
  pptx.company = "Healthrise";
  pptx.subject = data.title;
  pptx.title = data.title;

  const cover = pptx.addSlide();
  cover.background = { color: themePalette.background };
  cover.addText(data.title, {
    x: 0.5,
    y: 1.5,
    w: 9,
    h: 1,
    fontSize: 42,
    bold: true,
    align: "left",
    color: themePalette.primary,
    fontFace: "Calibri Light",
  });

  if (data.subtitle) {
    cover.addText(data.subtitle, {
      x: 0.5,
      y: 2.6,
      w: 8,
      h: 0.6,
      fontSize: 22,
      color: themePalette.muted,
    });
  }

  data.slides.forEach((slideData, index) => {
    const slide = pptx.addSlide();
    slide.background = { color: themePalette.background };
    slide.addText(slideData.title, {
      x: 0.5,
      y: 0.4,
      w: 9,
      h: 0.6,
      fontSize: 30,
      bold: true,
      color: themePalette.primary,
      fontFace: "Calibri",
    });

    const body = deriveFallbackContent(slideData);
    const textItems: TextProps[] =
      body.length > 0
        ? body.map((line) => ({
            text: line,
            options: { bullet: line.trim().length > 0 },
          }))
        : [
            {
              text: slideData.title,
              options: { bullet: false },
            },
          ];

    slide.addText(textItems, {
      x: 0.6,
      y: 1.2,
      w: 8.8,
      h: 4.5,
      fontSize: 18,
      color: themePalette.text,
      fontFace: "Calibri",
    });

    if (slideData.notes) {
      slide.addNotes(slideData.notes);
    }

    if (includeFooter) {
      slide.addText(`${index + 1}/${data.slides.length}`, {
        x: 9,
        y: 6.5,
        w: 1,
        h: 0.3,
        fontSize: 12,
        color: themePalette.muted,
        align: "right",
      });
    }
  });

  return pptx.write({
    outputType: "nodebuffer",
    compression: true,
  }) as Promise<Buffer>;
}

function deriveFallbackContent(slide: PresentationSlide): string[] {
  switch (slide.layout) {
    case "section-break": {
      const section = slide as SectionBreakSlide;
      const bullets = [];
      if (section.description) bullets.push(section.description);
      if (section.highlights) bullets.push(...section.highlights);
      return bullets.length > 0 ? bullets : [slide.title];
    }
    case "bullets": {
      const bulletSlide = slide as BulletSlide;
      const bullets = [...bulletSlide.bullets];
      if (bulletSlide.supportingPoints) {
        bullets.push(...bulletSlide.supportingPoints);
      }
      return bullets.length > 0 ? bullets : [slide.title];
    }
    case "two-column": {
      const twoCol = slide as TwoColumnSlide;
      return [
        ...(twoCol.leftColumn || []),
        ...(twoCol.rightColumn || []),
      ].filter(Boolean);
    }
    case "kpi-grid": {
      const grid = slide as KpiGridSlide;
      return grid.metrics.map((metric) => `${metric.label}: ${metric.value}`);
    }
    case "quote": {
      const quote = slide as QuoteSlide;
      const bullets = [`"${quote.quote}"`];
      if (quote.attribution) bullets.push(`- ${quote.attribution}`);
      if (quote.supportingPoints) bullets.push(...quote.supportingPoints);
      return bullets;
    }
    case "comparison": {
      const comparison = slide as ComparisonSlide;
      return comparison.columns.flatMap((column) => {
        const header = column.title ? `${column.title}:` : undefined;
        const content = column.bullets || [];
        return header ? [header, ...content] : content;
      });
    }
    case "timeline": {
      const timeline = slide as TimelineSlide;
      return [
        ...(timeline.summary ? [timeline.summary] : []),
        ...timeline.milestones.map((milestone) => {
          const segments = [
            milestone.date,
            milestone.title,
            milestone.description,
          ].filter(Boolean);
          return segments.join(" — ");
        }),
      ];
    }
    default:
      return [slide.title];
  }
}

/**
 * Validate presentation data structure
 */
export function validatePresentationData(
  data: unknown,
): data is PresentationData {
  if (!data || typeof data !== "object") return false;

  const candidate = data as Partial<PresentationData>;
  if (
    typeof candidate.title !== "string" ||
    candidate.title.trim().length === 0
  ) {
    return false;
  }

  if (!Array.isArray(candidate.slides) || candidate.slides.length === 0) {
    return false;
  }

  const validLayouts: SlideLayoutType[] = [
    "section-break",
    "bullets",
    "two-column",
    "kpi-grid",
    "quote",
    "comparison",
    "timeline",
  ];

  for (const slide of candidate.slides as PresentationSlide[]) {
    if (!slide || typeof slide !== "object") return false;
    if (typeof slide.title !== "string" || slide.title.trim() === "") {
      return false;
    }
    if (!validLayouts.includes(slide.layout)) {
      return false;
    }
    if (slide.notes && typeof slide.notes !== "string") {
      return false;
    }

    switch (slide.layout) {
      case "section-break": {
        const section = slide as SectionBreakSlide;
        if (section.description && typeof section.description !== "string") {
          return false;
        }
        if (
          section.highlights &&
          (!Array.isArray(section.highlights) ||
            !section.highlights.every((item) => typeof item === "string"))
        ) {
          return false;
        }
        break;
      }
      case "bullets": {
        const bulletSlide = slide as BulletSlide;
        if (
          !Array.isArray(bulletSlide.bullets) ||
          bulletSlide.bullets.length === 0 ||
          !bulletSlide.bullets.every((item) => typeof item === "string")
        ) {
          return false;
        }
        if (
          bulletSlide.supportingPoints &&
          (!Array.isArray(bulletSlide.supportingPoints) ||
            !bulletSlide.supportingPoints.every(
              (item) => typeof item === "string",
            ))
        ) {
          return false;
        }
        break;
      }
      case "two-column": {
        const twoCol = slide as TwoColumnSlide;
        if (
          !Array.isArray(twoCol.leftColumn) ||
          !twoCol.leftColumn.every((item) => typeof item === "string")
        ) {
          return false;
        }
        if (
          !Array.isArray(twoCol.rightColumn) ||
          !twoCol.rightColumn.every((item) => typeof item === "string")
        ) {
          return false;
        }
        if (twoCol.rightTitle && typeof twoCol.rightTitle !== "string") {
          return false;
        }
        break;
      }
      case "kpi-grid": {
        const grid = slide as KpiGridSlide;
        if (!Array.isArray(grid.metrics) || grid.metrics.length === 0) {
          return false;
        }
        for (const metric of grid.metrics) {
          if (
            typeof metric.label !== "string" ||
            metric.label.trim() === "" ||
            typeof metric.value !== "string" ||
            metric.value.trim() === ""
          ) {
            return false;
          }
          if (metric.delta && typeof metric.delta !== "string") {
            return false;
          }
          if (metric.description && typeof metric.description !== "string") {
            return false;
          }
        }
        if (grid.summary && typeof grid.summary !== "string") {
          return false;
        }
        if (
          grid.footnotes &&
          (!Array.isArray(grid.footnotes) ||
            !grid.footnotes.every((item) => typeof item === "string"))
        ) {
          return false;
        }
        break;
      }
      case "quote": {
        const quote = slide as QuoteSlide;
        if (typeof quote.quote !== "string" || quote.quote.trim() === "") {
          return false;
        }
        if (quote.attribution && typeof quote.attribution !== "string") {
          return false;
        }
        if (
          quote.supportingPoints &&
          (!Array.isArray(quote.supportingPoints) ||
            !quote.supportingPoints.every(
              (item) => typeof item === "string",
            ))
        ) {
          return false;
        }
        break;
      }
      case "comparison": {
        const comparison = slide as ComparisonSlide;
        if (
          typeof comparison.summary !== "undefined" &&
          typeof comparison.summary !== "string"
        ) {
          return false;
        }
        if (
          typeof comparison.tableTitle !== "undefined" &&
          typeof comparison.tableTitle !== "string"
        ) {
          return false;
        }
        if (
          !Array.isArray(comparison.columns) ||
          comparison.columns.length === 0
        ) {
          return false;
        }
        for (const column of comparison.columns) {
          if (
            typeof column.title !== "string" ||
            column.title.trim() === ""
          ) {
            return false;
          }
          if (
            !Array.isArray(column.bullets) ||
            column.bullets.length === 0 ||
            !column.bullets.every((item) => typeof item === "string")
          ) {
            return false;
          }
        }
        if (
          comparison.footnotes &&
          (!Array.isArray(comparison.footnotes) ||
            !comparison.footnotes.every((item) => typeof item === "string"))
        ) {
          return false;
        }
        break;
      }
      case "timeline": {
        const timeline = slide as TimelineSlide;
        if (
          typeof timeline.summary !== "undefined" &&
          typeof timeline.summary !== "string"
        ) {
          return false;
        }
        if (
          !Array.isArray(timeline.milestones) ||
          timeline.milestones.length === 0
        ) {
          return false;
        }
        for (const milestone of timeline.milestones) {
          if (
            typeof milestone.title !== "string" ||
            milestone.title.trim() === ""
          ) {
            return false;
          }
          if (
            milestone.date &&
            typeof milestone.date !== "string"
          ) {
            return false;
          }
          if (
            milestone.description &&
            typeof milestone.description !== "string"
          ) {
            return false;
          }
        }
        if (
          timeline.footnotes &&
          (!Array.isArray(timeline.footnotes) ||
            !timeline.footnotes.every((item) => typeof item === "string"))
        ) {
          return false;
        }
        break;
      }
      default:
        return false;
    }
  }

  return true;
}
