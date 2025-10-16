import "server-only";

import JSZip from "jszip";
import { Builder, parseStringPromise } from "xml2js";
import fs from "fs/promises";
import path from "path";
import logger from "logger";
import type {
  PresentationData,
  PresentationSlide,
  SlideLayoutType,
  SectionBreakSlide,
  BulletSlide,
  TwoColumnSlide,
  KpiGridSlide,
  QuoteSlide,
  ComparisonSlide,
  TimelineSlide,
} from "./pptx-builder";
import { loadWhiteLogoAsJpeg } from "./brand-assets";

const TEMPLATE_PATH = path.join(process.cwd(), ".yak", "template__Comp.pptx");

type ThemeOption = "healthrise" | "light" | "dark";

interface TemplateOptions {
  theme?: ThemeOption;
  includeFooter?: boolean;
}

const builder = new Builder();

interface TextStyleOptions {
  color?: string;
  size?: number;
  align?: "left" | "center" | "right";
  bullet?: boolean;
  bold?: boolean;
}

type TextRunInput = string | { text: string; style?: TextStyleOptions };

const SLIDE_REL_TYPE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide";
const NOTES_REL_TYPE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide";
const HYPERLINK_REL_TYPE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink";

const LAYOUT_SOURCE_SLIDES: Record<SlideLayoutType, number> = {
  "section-break": 3,
  bullets: 5,
  "two-column": 6,
  "kpi-grid": 4,
  quote: 14,
  comparison: 13,
  timeline: 11,
};

const NOTE_TEMPLATE_SLIDE = 2;

interface SlidePrototype {
  slideNumber: number;
  slideXml: any;
  relsXml?: any;
}

interface NotesPrototype {
  notesXml: any;
  relsXml: any;
}

interface LayoutImplementation {
  populate: (
    slideXml: any,
    slideData: PresentationSlide,
    options: { includeFooter: boolean },
  ) => void;
}

// Type guards for slide data validation
function isSectionBreakSlide(data: PresentationSlide): data is SectionBreakSlide {
  return data.layout === "section-break" && typeof data.title === "string";
}

function isBulletSlide(data: PresentationSlide): data is BulletSlide {
  return (
    data.layout === "bullets" &&
    typeof data.title === "string" &&
    Array.isArray((data as BulletSlide).bullets)
  );
}

function isTwoColumnSlide(data: PresentationSlide): data is TwoColumnSlide {
  return (
    data.layout === "two-column" &&
    typeof data.title === "string" &&
    Array.isArray((data as TwoColumnSlide).leftColumn)
  );
}

function isKpiGridSlide(data: PresentationSlide): data is KpiGridSlide {
  return data.layout === "kpi-grid" && typeof data.title === "string";
}

function isQuoteSlide(data: PresentationSlide): data is QuoteSlide {
  return (
    data.layout === "quote" &&
    typeof (data as QuoteSlide).quote === "string"
  );
}

function isComparisonSlide(data: PresentationSlide): data is ComparisonSlide {
  return (
    data.layout === "comparison" &&
    typeof data.title === "string" &&
    Array.isArray((data as ComparisonSlide).columns)
  );
}

function isTimelineSlide(data: PresentationSlide): data is TimelineSlide {
  return (
    data.layout === "timeline" &&
    typeof data.title === "string" &&
    Array.isArray((data as TimelineSlide).milestones)
  );
}

const LAYOUT_IMPLEMENTATIONS: Record<SlideLayoutType, LayoutImplementation> = {
  "section-break": {
    populate: (slideXml, slideData, options) => {
      if (!isSectionBreakSlide(slideData)) {
        throw new Error(`Invalid data for section-break slide: missing required fields`);
      }
      populateSectionBreakSlide(slideXml, slideData);
    },
  },
  bullets: {
    populate: (slideXml, slideData, options) => {
      if (!isBulletSlide(slideData)) {
        throw new Error(`Invalid data for bullets slide: missing title or bullets array`);
      }
      populateBulletSlide(slideXml, slideData, options);
    },
  },
  "two-column": {
    populate: (slideXml, slideData, options) => {
      if (!isTwoColumnSlide(slideData)) {
        throw new Error(`Invalid data for two-column slide: missing title or leftColumn array`);
      }
      populateTwoColumnSlide(slideXml, slideData, options);
    },
  },
  "kpi-grid": {
    populate: (slideXml, slideData, options) => {
      if (!isKpiGridSlide(slideData)) {
        throw new Error(`Invalid data for kpi-grid slide: missing title`);
      }
      populateKpiGridSlide(slideXml, slideData, options);
    },
  },
  quote: {
    populate: (slideXml, slideData, options) => {
      if (!isQuoteSlide(slideData)) {
        throw new Error(`Invalid data for quote slide: missing quote text`);
      }
      populateQuoteSlide(slideXml, slideData, options);
    },
  },
  comparison: {
    populate: (slideXml, slideData, options) => {
      if (!isComparisonSlide(slideData)) {
        throw new Error(`Invalid data for comparison slide: missing title or columns array`);
      }
      populateComparisonSlide(slideXml, slideData, options);
    },
  },
  timeline: {
    populate: (slideXml, slideData, options) => {
      if (!isTimelineSlide(slideData)) {
        throw new Error(`Invalid data for timeline slide: missing title or milestones array`);
      }
      populateTimelineSlide(slideXml, slideData, options);
    },
  },
};

export async function generatePPTXFromTemplate(
  data: PresentationData,
  options: TemplateOptions = {},
): Promise<Buffer> {
  const { theme = "healthrise", includeFooter = true } = options;

  try {
    logger.info(
      `Generating PPTX from Healthrise template with ${data.slides.length} content slides`,
    );

    // Validate input data
    if (!data.title) {
      throw new Error("Presentation data must include a title");
    }
    if (!Array.isArray(data.slides)) {
      throw new Error("Presentation data must include a slides array");
    }

    // Load and validate template
    let templateBuffer: Buffer;
    try {
      templateBuffer = await fs.readFile(TEMPLATE_PATH);
    } catch (error) {
      throw new Error(`Failed to read template file at ${TEMPLATE_PATH}: ${error}`);
    }

    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(templateBuffer);
    } catch (error) {
      throw new Error(`Failed to parse template as valid PPTX file: ${error}`);
    }

    const layoutPrototypes = await loadLayoutPrototypes(zip);
    const notesPrototype = await loadNotesPrototype(zip);

    const [presentation, presentationRels, contentTypes] = await Promise.all([
      parseXml(zip, "ppt/presentation.xml"),
      parseXml(zip, "ppt/_rels/presentation.xml.rels"),
      parseXml(zip, "[Content_Types].xml"),
    ]);

    await applyTheme(zip, theme);
    await ensureBrandAssets(zip, theme);

    await updateTitleSlide(zip, data);

    await resetExistingSlides(zip, presentation, presentationRels, contentTypes);

    let nextSlideNumber = 2;
    let nextRelationshipId = determineNextRelationshipId(presentationRels);
    let processedSlides = 0;

    for (const slideData of data.slides) {
      try {
        const prototype = layoutPrototypes[slideData.layout];
        const implementation = LAYOUT_IMPLEMENTATIONS[slideData.layout];

        if (!prototype || !implementation) {
          logger.warn(
            `Unsupported layout "${slideData.layout}" – skipping slide "${slideData.title}"`,
          );
          continue;
        }

        const slideClone = deepClone(prototype.slideXml);
        const relsClone = prototype.relsXml ? deepClone(prototype.relsXml) : null;

        implementation.populate(slideClone, slideData, { includeFooter });

        if (!includeFooter) {
          clearShapeText(slideClone, "Slide Number Placeholder 47");
        }

        const slidePath = `ppt/slides/slide${nextSlideNumber}.xml`;
        zip.file(slidePath, builder.buildObject(slideClone));

        const slideRelsPath = `ppt/slides/_rels/slide${nextSlideNumber}.xml.rels`;
        const adjustedRels = adjustSlideRelationships(
          relsClone,
          slideData.notes,
          nextSlideNumber,
        );
        if (adjustedRels) {
          zip.file(slideRelsPath, builder.buildObject(adjustedRels));
        }

        if (slideData.notes) {
          if (notesPrototype) {
            createNotesParts(
              zip,
              notesPrototype,
              slideData.notes,
              nextSlideNumber,
            );
            addNotesOverride(contentTypes, nextSlideNumber);
            updateSlideNotesRelationship(adjustedRels, nextSlideNumber);
          } else {
            logger.warn(
              `Speaker notes requested for slide "${slideData.title}" but notes template is unavailable.`,
            );
            if (adjustedRels) {
              removeNotesRelationship(adjustedRels);
            }
          }
        } else if (adjustedRels) {
          removeNotesRelationship(adjustedRels);
        }

        addSlideToPresentation(
          presentation,
          presentationRels,
          nextSlideNumber,
          ++nextRelationshipId,
        );

        addSlideOverride(contentTypes, nextSlideNumber);

        nextSlideNumber += 1;
        processedSlides += 1;
      } catch (slideError) {
        logger.error(
          `Error processing slide "${slideData.title}" (layout: ${slideData.layout}):`,
          slideError,
        );
        // Continue processing other slides rather than failing completely
        continue;
      }
    }

    if (processedSlides === 0 && data.slides.length > 0) {
      throw new Error("Failed to process any slides - presentation generation aborted");
    }

    zip.file("ppt/presentation.xml", builder.buildObject(presentation));
    zip.file(
      "ppt/_rels/presentation.xml.rels",
      builder.buildObject(presentationRels),
    );
    zip.file("[Content_Types].xml", builder.buildObject(contentTypes));

    let buffer: Buffer;
    try {
      buffer = await zip.generateAsync({
        type: "nodebuffer",
        compression: "DEFLATE",
        compressionOptions: { level: 9 },
      });
    } catch (error) {
      throw new Error(`Failed to generate final PPTX buffer: ${error}`);
    }

    logger.info(
      `Finished generating PPTX (${processedSlides} of ${data.slides.length} slides, ${buffer.length} bytes)`,
    );

    return buffer;
  } catch (error) {
    logger.error("Fatal error during PPTX generation:", error);
    throw error;
  }
}

async function parseXml(zip: JSZip, pathName: string): Promise<any> {
  const file = zip.file(pathName);
  if (!file) {
    throw new Error(`Template missing expected part: ${pathName}`);
  }
  return parseStringPromise(await file.async("string"));
}

async function loadLayoutPrototypes(
  zip: JSZip,
): Promise<Record<SlideLayoutType, SlidePrototype>> {
  const prototypes: Partial<Record<SlideLayoutType, SlidePrototype>> = {};
  const missingSlides: string[] = [];

  for (const [layout, slideNumber] of Object.entries(LAYOUT_SOURCE_SLIDES)) {
    const slidePath = `ppt/slides/slide${slideNumber}.xml`;
    const relsPath = `ppt/slides/_rels/slide${slideNumber}.xml.rels`;

    const slideFile = zip.file(slidePath);
    if (!slideFile) {
      missingSlides.push(`${layout} (slide ${slideNumber})`);
      logger.error(`Missing template slide ${slideNumber} for layout ${layout}`);
      continue;
    }

    try {
      const slideXml = await parseStringPromise(await slideFile.async("string"));
      const relsFile = zip.file(relsPath);
      const relsXml = relsFile
        ? await parseStringPromise(await relsFile.async("string"))
        : undefined;

      prototypes[layout as SlideLayoutType] = {
        slideNumber,
        slideXml,
        relsXml,
      };
    } catch (error) {
      logger.error(`Failed to parse template slide ${slideNumber} for layout ${layout}:`, error);
      missingSlides.push(`${layout} (slide ${slideNumber})`);
    }
  }

  if (missingSlides.length > 0) {
    throw new Error(
      `Template validation failed - missing or invalid layout slides: ${missingSlides.join(", ")}`,
    );
  }

  return prototypes as Record<SlideLayoutType, SlidePrototype>;
}

async function loadNotesPrototype(zip: JSZip): Promise<NotesPrototype | null> {
  const notesPath = `ppt/notesSlides/notesSlide${NOTE_TEMPLATE_SLIDE}.xml`;
  const relsPath = `ppt/notesSlides/_rels/notesSlide${NOTE_TEMPLATE_SLIDE}.xml.rels`;

  const notesFile = zip.file(notesPath);
  const relsFile = zip.file(relsPath);

  if (!notesFile || !relsFile) {
    logger.warn("Notes slide template not found – speaker notes will be skipped");
    return null;
  }

  const [notesXml, relsXml] = await Promise.all([
    parseStringPromise(await notesFile.async("string")),
    parseStringPromise(await relsFile.async("string")),
  ]);

  return { notesXml, relsXml };
}

async function applyTheme(zip: JSZip, theme: ThemeOption): Promise<void> {
  if (theme === "healthrise") {
    return;
  }

  const sourceThemeFile =
    theme === "light" ? "ppt/theme/theme2.xml" : "ppt/theme/theme3.xml";
  const targetThemeFile = "ppt/theme/theme1.xml";

  const source = zip.file(sourceThemeFile);
  const target = zip.file(targetThemeFile);

  if (!source || !target) {
    logger.warn(`Unable to switch to ${theme} theme – source or target theme file not found, falling back to default`);
    return;
  }

  const themeContent = await source.async("string");
  zip.file(targetThemeFile, themeContent);
  logger.info(`Applied ${theme} theme successfully`);
}

async function ensureBrandAssets(
  zip: JSZip,
  theme: ThemeOption = "healthrise",
): Promise<void> {
  try {
    const logoBuffer = await loadWhiteLogoAsJpeg(theme);
    if (!logoBuffer) {
      return;
    }

    const targetFile = "ppt/media/image2.jpg";
    const existing = await zip.file(targetFile)?.async("nodebuffer").catch(() => null);
    if (existing && existing.equals(logoBuffer)) {
      return;
    }

    if (!zip.file(targetFile)) {
      logger.warn(`Expected logo slot ${targetFile} missing in template; skipping replacement.`);
      return;
    }

    zip.file(targetFile, logoBuffer);
    logger.info(`Updated template logo with ${theme} theme variant.`);
  } catch (error) {
    logger.warn(`Failed to refresh template logo with ${theme} theme variant:`, error);
  }
}

async function updateTitleSlide(zip: JSZip, data: PresentationData): Promise<void> {
  const slidePath = "ppt/slides/slide1.xml";
  const slideFile = zip.file(slidePath);

  if (!slideFile) {
    throw new Error("Template does not include a title slide");
  }

  const slide = await parseStringPromise(await slideFile.async("string"));
  setShapeLines(slide, "Title 1", [
    { text: data.title, style: { color: "FFFFFF", size: 4000, bold: true, align: "left" } },
  ]);

  if (data.subtitle) {
    setShapeLines(slide, "TextBox 45", [
      { text: data.subtitle, style: { color: "FFFFFF", size: 2400, align: "left" } },
    ]);
  } else if (data.author) {
    setShapeLines(slide, "TextBox 45", [
      { text: data.author, style: { color: "FFFFFF", size: 2400, align: "left" } },
    ]);
  } else {
    clearShapeText(slide, "TextBox 45");
  }

  softenShapeFill(slide, "Freeform 31", { opacity: 0.25 });
  softenShapeFill(slide, "Freeform 18", { opacity: 0.18 });

  zip.file(slidePath, builder.buildObject(slide));
}

async function resetExistingSlides(
  zip: JSZip,
  presentation: any,
  presentationRels: any,
  contentTypes: any,
): Promise<void> {
  for (const fileName of Object.keys(zip.files)) {
    if (/^ppt\/slides\/slide\d+\.xml$/.test(fileName) && fileName !== "ppt/slides/slide1.xml") {
      zip.remove(fileName);
    }
    if (/^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/.test(fileName)) {
      zip.remove(fileName);
    }
    if (/^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(fileName)) {
      zip.remove(fileName);
    }
    if (/^ppt\/notesSlides\/_rels\/notesSlide\d+\.xml\.rels$/.test(fileName)) {
      zip.remove(fileName);
    }
  }

  const slideIdList =
    presentation?.["p:presentation"]?.["p:sldIdLst"]?.[0]?.["p:sldId"] ?? [];
  if (slideIdList.length > 1) {
    presentation["p:presentation"]["p:sldIdLst"][0]["p:sldId"] = [
      slideIdList[0],
    ];
  }

  presentationRels.Relationships.Relationship =
    presentationRels.Relationships.Relationship.filter(
      (rel: any) =>
        rel.$.Type !== SLIDE_REL_TYPE ||
        rel.$.Target === "slides/slide1.xml",
    );

  contentTypes.Types.Override = (contentTypes.Types.Override || []).filter(
    (override: any) => {
      const part = override.$.PartName;
      return !part.startsWith("/ppt/slides/slide") ||
        part === "/ppt/slides/slide1.xml";
    },
  );
}

function determineNextRelationshipId(presentationRels: any): number {
  const relationships = presentationRels.Relationships.Relationship || [];
  const usedIds = new Set<number>();

  relationships.forEach((rel: any) => {
    const match = rel.$.Id.match(/^rId(\d+)$/);
    if (match) {
      usedIds.add(Number.parseInt(match[1], 10));
    }
  });

  // Find the next available ID (not just max + 1)
  let nextId = 1;
  while (usedIds.has(nextId)) {
    nextId++;
  }

  // Return the max of all IDs to ensure we start above existing IDs
  return Math.max(nextId - 1, ...Array.from(usedIds), 0);
}

function addSlideToPresentation(
  presentation: any,
  presentationRels: any,
  slideNumber: number,
  relationshipId: number,
): void {
  const slideIdList =
    presentation["p:presentation"]["p:sldIdLst"]?.[0]?.["p:sldId"];

  if (!Array.isArray(slideIdList)) {
    presentation["p:presentation"]["p:sldIdLst"] = [
      { "p:sldId": [] },
    ];
  }

  presentation["p:presentation"]["p:sldIdLst"][0]["p:sldId"].push({
    $: {
      id: `${256 + slideNumber}`,
      "r:id": `rId${relationshipId}`,
    },
  });

  presentationRels.Relationships.Relationship.push({
    $: {
      Id: `rId${relationshipId}`,
      Type: SLIDE_REL_TYPE,
      Target: `slides/slide${slideNumber}.xml`,
    },
  });
}

function addSlideOverride(contentTypes: any, slideNumber: number): void {
  contentTypes.Types.Override = contentTypes.Types.Override || [];
  contentTypes.Types.Override.push({
    $: {
      PartName: `/ppt/slides/slide${slideNumber}.xml`,
      ContentType:
        "application/vnd.openxmlformats-officedocument.presentationml.slide+xml",
    },
  });
}

function addNotesOverride(contentTypes: any, slideNumber: number): void {
  contentTypes.Types.Override = contentTypes.Types.Override || [];
  contentTypes.Types.Override.push({
    $: {
      PartName: `/ppt/notesSlides/notesSlide${slideNumber}.xml`,
      ContentType:
        "application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml",
    },
  });
}

function adjustSlideRelationships(
  relsXml: any,
  notes: string | undefined,
  newSlideNumber: number,
): any | null {
  if (!relsXml) return null;

  relsXml.Relationships.Relationship = (relsXml.Relationships.Relationship || [])
    .filter((rel: any) => rel.$.Type !== HYPERLINK_REL_TYPE)
    .map((rel: any) => {
      if (rel.$.Type === NOTES_REL_TYPE) {
        if (!notes) {
          return null;
        }
        rel.$.Target = `../notesSlides/notesSlide${newSlideNumber}.xml`;
      }
      return rel;
    })
    .filter(Boolean);

  return relsXml;
}

function updateSlideNotesRelationship(relsXml: any, slideNumber: number): void {
  if (!relsXml) return;

  const existing = (relsXml.Relationships.Relationship || []).find(
    (rel: any) => rel.$.Type === NOTES_REL_TYPE,
  );

  if (existing) {
    existing.$.Target = `../notesSlides/notesSlide${slideNumber}.xml`;
    return;
  }

  (relsXml.Relationships.Relationship =
    relsXml.Relationships.Relationship || []).push({
    $: {
      Id: "rId2",
      Type: NOTES_REL_TYPE,
      Target: `../notesSlides/notesSlide${slideNumber}.xml`,
    },
  });
}

function removeNotesRelationship(relsXml: any): void {
  if (!relsXml) return;

  relsXml.Relationships.Relationship = (relsXml.Relationships.Relationship || []).filter(
    (rel: any) => rel.$.Type !== NOTES_REL_TYPE,
  );
}

function createNotesParts(
  zip: JSZip,
  prototype: NotesPrototype,
  notes: string,
  slideNumber: number,
): { notesPath: string; notesRelsPath: string } {
  const noteClone = deepClone(prototype.notesXml);
  const relClone = deepClone(prototype.relsXml);

  setNotesText(noteClone, notes);

  const notesPath = `ppt/notesSlides/notesSlide${slideNumber}.xml`;
  const notesRelsPath = `ppt/notesSlides/_rels/notesSlide${slideNumber}.xml.rels`;

  updateNoteRelationship(relClone, slideNumber);

  zip.file(notesPath, builder.buildObject(noteClone));
  zip.file(notesRelsPath, builder.buildObject(relClone));

  return { notesPath, notesRelsPath };
}

function updateNoteRelationship(relsXml: any, slideNumber: number): void {
  relsXml.Relationships.Relationship = (relsXml.Relationships.Relationship || []).map(
    (rel: any) => {
      if (rel.$.Type === SLIDE_REL_TYPE) {
        rel.$.Target = `../slides/slide${slideNumber}.xml`;
      }
      return rel;
    },
  );
}

function setNotesText(notesXml: any, notes: string): void {
  const lines = splitIntoParagraphs(notes);
  setShapeLines(notesXml, "Notes Placeholder 2", lines.length ? lines : [""]);
}

function populateSectionBreakSlide(
  slideXml: any,
  slideData: SectionBreakSlide,
): void {
  setShapeLines(slideXml, "Title 5", [
    { text: slideData.title, style: { size: 3400, bold: true, color: "#101D41", align: "left" } },
  ]);

  if (slideData.description) {
    setShapeLines(slideXml, "TextBox 7", [
      { text: slideData.description, style: { align: "left", size: 2200 } },
    ]);
  } else {
    clearShapeText(slideXml, "TextBox 7");
  }

  if (slideData.highlights && slideData.highlights.length > 0) {
    const highlightLines: TextRunInput[] = slideData.highlights.flatMap(
      (point, index, array) => [
        { text: point, style: { align: "left" } },
        ...(index < array.length - 1
          ? [{ text: " ", style: { bullet: false } }]
          : []),
      ],
    );
    setShapeLines(slideXml, "TextBox 8", highlightLines);
  } else {
    clearShapeText(slideXml, "TextBox 8");
  }

  softenShapeFill(slideXml, "Graphic 37", { opacity: 0.08 });
}

function populateBulletSlide(
  slideXml: any,
  slideData: BulletSlide,
  options: { includeFooter: boolean },
): void {
  if (slideData.eyebrow) {
    setShapeLines(slideXml, "TextBox 27", [
      { text: slideData.eyebrow, style: { align: "left", size: 2000, color: "#2C4A78" } },
    ]);
  } else {
    clearShapeText(slideXml, "TextBox 27");
  }

  setShapeLines(slideXml, "TextBox 14", [
    { text: slideData.title, style: { align: "left", size: 3200, bold: true, color: "#101D41" } },
  ]);

  setShapeLines(
    slideXml,
    "TextBox 13",
    slideData.bullets.map((bullet) => ({ text: bullet, style: { align: "left" } })),
  );

  if (slideData.supportingPoints && slideData.supportingPoints.length > 0) {
    setShapeLines(
      slideXml,
      "TextBox 11",
      slideData.supportingPoints.map((point) => ({ text: point, style: { align: "left" } })),
    );
  } else {
    clearShapeText(slideXml, "TextBox 11");
  }

  if (options.includeFooter) {
    if (slideData.kickerLeft) {
      setShapeLines(slideXml, "TextBox 4", [
        { text: slideData.kickerLeft, style: { align: "left", size: 2000, color: "#2C4A78" } },
      ]);
    }
    if (slideData.kickerRight) {
      setShapeLines(slideXml, "TextBox 5", [
        { text: slideData.kickerRight, style: { align: "right", size: 2000, color: "#2C4A78" } },
      ]);
    }
  } else {
    stripFooterDecorations(slideXml);
  }
}

function populateTwoColumnSlide(
  slideXml: any,
  slideData: TwoColumnSlide,
  options: { includeFooter: boolean },
): void {
  setShapeLines(slideXml, "TextBox 14", [
    { text: slideData.title, style: { align: "left", size: 3200, bold: true, color: "#101D41" } },
  ]);

  setShapeLines(
    slideXml,
    "TextBox 13",
    slideData.leftColumn.map((item) => ({ text: item, style: { align: "left" } })),
  );

  const rightLines: TextRunInput[] = [];
  if (slideData.rightTitle) {
    rightLines.push({ text: slideData.rightTitle, style: { bullet: false, bold: true, size: 2400, align: "left" } });
    rightLines.push({ text: " ", style: { bullet: false } });
  }
  rightLines.push(
    ...(slideData.rightColumn ?? []).map((item) => ({ text: item, style: { align: "left" } })),
  );
  setShapeLines(slideXml, "TextBox 11", rightLines);

  if (slideData.eyebrow) {
    setShapeLines(slideXml, "TextBox 4", [
      { text: slideData.eyebrow, style: { align: "left", size: 2000, color: "#2C4A78" } },
    ]);
  } else if (!options.includeFooter) {
    stripFooterDecorations(slideXml);
  }

  if (!options.includeFooter) {
    stripFooterDecorations(slideXml);
  }
}

function populateKpiGridSlide(
  slideXml: any,
  slideData: KpiGridSlide,
  options: { includeFooter: boolean },
): void {
  setShapeLines(slideXml, "TextBox 14", [
    { text: slideData.title, style: { align: "left", size: 3200, bold: true, color: "#101D41" } },
  ]);

  if (slideData.summary) {
    setShapeLines(slideXml, "Rounded Rectangle 35", [
      { text: slideData.summary, style: { align: "left", size: 2200, color: "#2C4A78" } },
    ]);
    setShapeLines(slideXml, "TextBox 13", [
      { text: slideData.summary, style: { align: "left", size: 2200 } },
    ]);
  } else {
    clearShapeText(slideXml, "Rounded Rectangle 35");
    clearShapeText(slideXml, "TextBox 13");
  }

  const metrics = (slideData.metrics || []).slice(0, 3);
  const metricShapes = ["TextBox 30", "TextBox 28", "TextBox 26"];

  metricShapes.forEach((shapeName, index) => {
    const metric = metrics[index];
    if (!metric) {
      clearShapeText(slideXml, shapeName);
      return;
    }

    resizeShape(slideXml, shapeName, { heightMultiplier: 1.18 });

    const metricLines: TextRunInput[] = [
      { text: metric.value, style: { size: 3200, bold: true, align: "left" } },
      { text: metric.label, style: { align: "left", size: 2200, color: "#1B425D" } },
    ];

    if (metric.delta) {
      metricLines.push({ text: `Δ ${metric.delta}`, style: { align: "left", color: "#2C7A4B" } });
    }
    if (metric.description) {
      metricLines.push({ text: metric.description, style: { align: "left" } });
    }

    setShapeLines(slideXml, shapeName, metricLines);
  });

  if (slideData.footnotes && slideData.footnotes.length > 0) {
    const formatted = slideData.footnotes.map((note, idx) => ({
      text: `${idx + 1}. ${note}`,
      style: { align: "left", bullet: false, size: 1800 },
    }));
    setShapeLines(slideXml, "TextBox 4", formatted);
    removeShape(slideXml, "TextBox 5");
  } else if (!options.includeFooter) {
    stripFooterDecorations(slideXml);
  }
}

function populateQuoteSlide(
  slideXml: any,
  slideData: QuoteSlide,
  options: { includeFooter: boolean },
): void {
  setShapeText(slideXml, "TextBox 1", slideData.title || "");

  if (slideData.eyebrow) {
    setShapeText(slideXml, "TextBox 14", slideData.eyebrow);
  } else {
    clearShapeText(slideXml, "TextBox 14");
  }

  setShapeLines(slideXml, "TextBox 43", wrapQuote(slideData.quote));

  if (slideData.attribution) {
    setShapeText(slideXml, "TextBox 6", slideData.attribution);
  } else {
    clearShapeText(slideXml, "TextBox 6");
  }

  if (slideData.supportingPoints && slideData.supportingPoints.length > 0) {
    setShapeLines(slideXml, "TextBox 43", [
      ...wrapQuote(slideData.quote),
      "",
      ...slideData.supportingPoints,
    ]);
  }

  if (!options.includeFooter) {
    clearShapeText(slideXml, "TextBox 4");
    clearShapeText(slideXml, "TextBox 5");
  }
}

function populateComparisonSlide(
  slideXml: any,
  slideData: ComparisonSlide,
  options: { includeFooter: boolean },
): void {
  setShapeText(slideXml, "TextBox 14", slideData.title);

  if (slideData.eyebrow) {
    setShapeText(slideXml, "TextBox 1", slideData.eyebrow);
  } else {
    clearShapeText(slideXml, "TextBox 1");
  }

  if (slideData.summary) {
    setShapeText(slideXml, "TextBox 13", slideData.summary);
  } else {
    clearShapeText(slideXml, "TextBox 13");
  }

  if (slideData.tableTitle) {
    setShapeText(slideXml, "Rounded Rectangle 39", slideData.tableTitle);
  } else {
    clearShapeText(slideXml, "Rounded Rectangle 39");
  }

  const headingShapes = ["TextBox 31", "TextBox 32", "TextBox 33"];
  const bodyShapes = ["TextBox 34", "TextBox 35", "TextBox 38"];

  headingShapes.forEach((shapeName, index) => {
    const column = slideData.columns[index];
    if (column) {
      setShapeText(slideXml, shapeName, column.title);
      setShapeLines(slideXml, bodyShapes[index], column.bullets);
    } else {
      clearShapeText(slideXml, shapeName);
      clearShapeText(slideXml, bodyShapes[index]);
    }
  });

  const footnoteShapes = ["TextBox 45", "TextBox 46", "TextBox 47"];
  if (slideData.footnotes && options.includeFooter) {
    footnoteShapes.forEach((shapeName, index) => {
      const note = slideData.footnotes?.[index];
      if (note) {
        setShapeText(slideXml, shapeName, note);
      } else {
        clearShapeText(slideXml, shapeName);
      }
    });
  } else {
    footnoteShapes.forEach((shapeName) => clearShapeText(slideXml, shapeName));
  }
}

function populateTimelineSlide(
  slideXml: any,
  slideData: TimelineSlide,
  options: { includeFooter: boolean },
): void {
  setShapeText(slideXml, "TextBox 5", slideData.title);

  const milestoneLines = [
    ...(slideData.summary ? [slideData.summary] : []),
    ...(
      slideData.milestones.map((milestone) => {
        const segments = [
          milestone.date,
          milestone.title,
          milestone.description,
        ].filter(Boolean);
        return segments.join(" — ");
      }) || []
    ),
  ];

  setShapeLines(slideXml, "Text Placeholder 12", milestoneLines);

  const footerShapes = ["TextBox 49", "TextBox 50"];
  if (options.includeFooter && slideData.footnotes) {
    footerShapes.forEach((shapeName, index) => {
      const value = slideData.footnotes?.[index];
      if (value) {
        setShapeText(slideXml, shapeName, value);
      } else {
        clearShapeText(slideXml, shapeName);
      }
    });
  } else {
    footerShapes.forEach((shapeName) => clearShapeText(slideXml, shapeName));
  }
}

function wrapQuote(quote: string): string[] {
  const trimmed = quote.trim();
  if (!trimmed) return [""];
  return [`“${trimmed}”`];
}

function setShapeLines(slideXml: any, shapeName: string, lines: string[]): void {
  const shape = findShapeByName(slideXml, shapeName);
  if (!shape) {
    logger.warn(`Shape "${shapeName}" not found in slide - content will be skipped`);
    return;
  }

  const txBody = shape["p:txBody"]?.[0];
  if (!txBody) {
    logger.warn(`Shape "${shapeName}" has no text body - cannot set text`);
    return;
  }

  const basePara = deepClone(txBody["a:p"]?.[0] ?? {});
  const normalizedLines = lines.length > 0 ? lines : [""];

  txBody["a:p"] = normalizedLines.map((line) =>
    buildParagraph(basePara, line),
  );
}

function setShapeText(slideXml: any, shapeName: string, text: string): void {
  setShapeLines(slideXml, shapeName, [text]);
}

function clearShapeText(slideXml: any, shapeName: string): void {
  const shape = findShapeByName(slideXml, shapeName);
  if (!shape) {
    logger.debug(`Shape "${shapeName}" not found - skipping clear operation`);
    return;
  }

  const txBody = shape["p:txBody"]?.[0];
  if (!txBody) {
    logger.debug(`Shape "${shapeName}" has no text body - skipping clear operation`);
    return;
  }

  const basePara = deepClone(txBody["a:p"]?.[0] ?? {});
  txBody["a:p"] = [buildParagraph(basePara, "")];
}

function buildParagraph(basePara: any, text: string): any {
  const paragraph: any = {};

  if (basePara["a:pPr"]) {
    paragraph["a:pPr"] = [deepClone(basePara["a:pPr"][0])];
  }

  const run: any = { "a:t": [text] };

  if (basePara["a:r"]?.[0]?.["a:rPr"]) {
    run["a:rPr"] = [deepClone(basePara["a:r"][0]["a:rPr"][0])];
  }

  paragraph["a:r"] = [run];

  if (basePara["a:endParaRPr"]) {
    paragraph["a:endParaRPr"] = [deepClone(basePara["a:endParaRPr"][0])];
  }

  return paragraph;
}

function findShapeByName(xml: any, name: string): any | null {
  const spTree =
    xml?.["p:sld"]?.["p:cSld"]?.[0]?.["p:spTree"]?.[0] ??
    xml?.["p:notes"]?.["p:cSld"]?.[0]?.["p:spTree"]?.[0];

  if (!spTree) return null;

  return findShapeByNameRecursive(spTree, name);
}

function findShapeByNameRecursive(node: any, targetName: string): any | null {
  const shapes: any[] = node?.["p:sp"] || [];
  for (const shape of shapes) {
    const cNvPr = shape?.["p:nvSpPr"]?.[0]?.["p:cNvPr"]?.[0];
    if (cNvPr?.$.name === targetName) {
      return shape;
    }
  }

  const groups: any[] = node?.["p:grpSp"] || [];
  for (const group of groups) {
    const result = findShapeByNameRecursive(group, targetName);
    if (result) return result;
  }

  return null;
}

function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line, index, arr) => !(line === "" && arr[index + 1] === ""));
}

function deepClone<T>(value: T): T {
  return value ? JSON.parse(JSON.stringify(value)) : value;
}

/**
 * Adjusts the opacity of a shape's fill color
 */
function softenShapeFill(
  slideXml: any,
  shapeName: string,
  options: { opacity: number },
): void {
  const shape = findShapeByName(slideXml, shapeName);
  if (!shape) {
    logger.warn(`Shape "${shapeName}" not found for opacity adjustment`);
    return;
  }

  const spPr = shape["p:spPr"]?.[0];
  if (!spPr) return;

  // Ensure we have a fill definition
  if (!spPr["a:solidFill"] && !spPr["a:gradFill"]) {
    return;
  }

  // Apply opacity to solid fill
  if (spPr["a:solidFill"]?.[0]) {
    const solidFill = spPr["a:solidFill"][0];
    const alphaValue = Math.round(options.opacity * 100000);

    // Find the color definition (could be srgbClr, schemeClr, etc.)
    const colorKeys = Object.keys(solidFill).filter(k => k.startsWith("a:"));
    colorKeys.forEach(colorKey => {
      if (solidFill[colorKey]?.[0]) {
        solidFill[colorKey][0]["a:alpha"] = [{ $: { val: alphaValue } }];
      }
    });
  }

  // Apply opacity to gradient fill
  if (spPr["a:gradFill"]?.[0]) {
    const gradFill = spPr["a:gradFill"][0];
    const alphaValue = Math.round(options.opacity * 100000);

    const gsLst = gradFill["a:gsLst"]?.[0]?.["a:gs"];
    if (gsLst) {
      gsLst.forEach((gs: any) => {
        const colorKeys = Object.keys(gs).filter(k => k.startsWith("a:"));
        colorKeys.forEach(colorKey => {
          if (gs[colorKey]?.[0]) {
            gs[colorKey][0]["a:alpha"] = [{ $: { val: alphaValue } }];
          }
        });
      });
    }
  }
}

/**
 * Removes footer decoration shapes (typically TextBox 4 and TextBox 5)
 */
function stripFooterDecorations(slideXml: any): void {
  clearShapeText(slideXml, "TextBox 4");
  clearShapeText(slideXml, "TextBox 5");
}

/**
 * Resizes a shape by adjusting its height
 */
function resizeShape(
  slideXml: any,
  shapeName: string,
  options: { heightMultiplier?: number; widthMultiplier?: number },
): void {
  const shape = findShapeByName(slideXml, shapeName);
  if (!shape) {
    logger.warn(`Shape "${shapeName}" not found for resizing`);
    return;
  }

  const spPr = shape["p:spPr"]?.[0];
  if (!spPr) return;

  const xfrm = spPr["a:xfrm"]?.[0];
  if (!xfrm) return;

  const ext = xfrm["a:ext"]?.[0];
  if (!ext?.$) return;

  if (options.heightMultiplier && ext.$.cy) {
    const currentHeight = Number.parseInt(ext.$.cy, 10);
    ext.$.cy = Math.round(currentHeight * options.heightMultiplier).toString();
  }

  if (options.widthMultiplier && ext.$.cx) {
    const currentWidth = Number.parseInt(ext.$.cx, 10);
    ext.$.cx = Math.round(currentWidth * options.widthMultiplier).toString();
  }
}

/**
 * Completely removes a shape from the slide
 */
function removeShape(slideXml: any, shapeName: string): void {
  const spTree =
    slideXml?.["p:sld"]?.["p:cSld"]?.[0]?.["p:spTree"]?.[0];

  if (!spTree) return;

  // Remove from shapes array
  if (spTree["p:sp"]) {
    spTree["p:sp"] = spTree["p:sp"].filter((shape: any) => {
      const cNvPr = shape?.["p:nvSpPr"]?.[0]?.["p:cNvPr"]?.[0];
      return cNvPr?.$.name !== shapeName;
    });
  }

  // Also check in groups
  if (spTree["p:grpSp"]) {
    spTree["p:grpSp"].forEach((group: any) => {
      if (group["p:sp"]) {
        group["p:sp"] = group["p:sp"].filter((shape: any) => {
          const cNvPr = shape?.["p:nvSpPr"]?.[0]?.["p:cNvPr"]?.[0];
          return cNvPr?.$.name !== shapeName;
        });
      }
    });
  }
}
