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
import { loadWhiteLogoAsJpeg, clearLogoCache } from "./brand-assets";
import {
  LAYOUT_BLUEPRINTS,
  type LayoutBlueprint,
  type ShapeTargetDescriptor,
} from "./layout-blueprints";

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
  rawXml: string;
  placeholders: PlaceholderMap;
}

interface PlaceholderMap {
  byType: Record<string, string[]>;
  byTypeIdx: Record<string, Record<number, string>>;
}

interface PlaceholderInfo {
  name: string;
  placeholderType?: string;
  placeholderIdx?: number;
}

interface NotesPrototype {
  notesXml: any;
  relsXml: any;
}

interface LayoutImplementation {
  populate: (
    slideXml: any,
    slideData: PresentationSlide,
    context: { includeFooter: boolean; prototype: SlidePrototype },
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

function extractGraphicGroup(xml: string, groupName: string): string | null {
  const pattern = new RegExp(
    `<p:grpSp>\\s*<p:nvGrpSpPr>\\s*<p:cNvPr[^>]*name="${groupName}"[\\s\\S]*?</p:grpSp>`,
    "m",
  );
  const match = pattern.exec(xml);
  return match ? match[0] : null;
}

function replaceGraphicGroup(xml: string, groupName: string, replacement: string): string {
  const pattern = new RegExp(
    `<p:grpSp>\\s*<p:nvGrpSpPr>\\s*<p:cNvPr[^>]*name="${groupName}"[\\s\\S]*?</p:grpSp>`,
    "m",
  );
  return xml.replace(pattern, replacement);
}

const LAYOUT_IMPLEMENTATIONS: Record<SlideLayoutType, LayoutImplementation> = {
  "section-break": {
    populate: (slideXml, slideData, context) => {
      if (!isSectionBreakSlide(slideData)) {
        throw new Error(`Invalid data for section-break slide: missing required fields`);
      }
      populateSectionBreakSlide(slideXml, slideData, context);
    },
  },
  bullets: {
    populate: (slideXml, slideData, context) => {
      if (!isBulletSlide(slideData)) {
        throw new Error(`Invalid data for bullets slide: missing title or bullets array`);
      }
      populateBulletSlide(slideXml, slideData, context);
    },
  },
  "two-column": {
    populate: (slideXml, slideData, context) => {
      if (!isTwoColumnSlide(slideData)) {
        throw new Error(`Invalid data for two-column slide: missing title or leftColumn array`);
      }
      populateTwoColumnSlide(slideXml, slideData, context);
    },
  },
  "kpi-grid": {
    populate: (slideXml, slideData, context) => {
      if (!isKpiGridSlide(slideData)) {
        throw new Error(`Invalid data for kpi-grid slide: missing title`);
      }
      populateKpiGridSlide(slideXml, slideData, context);
    },
  },
  quote: {
    populate: (slideXml, slideData, context) => {
      if (!isQuoteSlide(slideData)) {
        throw new Error(`Invalid data for quote slide: missing quote text`);
      }
      populateQuoteSlide(slideXml, slideData, context);
    },
  },
  comparison: {
    populate: (slideXml, slideData, context) => {
      if (!isComparisonSlide(slideData)) {
        throw new Error(`Invalid data for comparison slide: missing title or columns array`);
      }
      populateComparisonSlide(slideXml, slideData, context);
    },
  },
  timeline: {
    populate: (slideXml, slideData, context) => {
      if (!isTimelineSlide(slideData)) {
        throw new Error(`Invalid data for timeline slide: missing title or milestones array`);
      }
      populateTimelineSlide(slideXml, slideData, context);
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

    // CRITICAL: Clear logo cache to ensure fresh logo is loaded every time
    clearLogoCache();
    logger.info("Cleared logo cache to ensure fresh logo");

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

        implementation.populate(slideClone, slideData, {
          includeFooter,
          prototype,
        });

        if (!includeFooter) {
          clearShapeText(slideClone, "Slide Number Placeholder 47");
        }

        const slidePath = `ppt/slides/slide${nextSlideNumber}.xml`;
        let slideXmlString = builder.buildObject(slideClone);
        if (includeFooter) {
          const footerGroup = extractGraphicGroup(prototype.rawXml, "Graphic 21");
          if (footerGroup) {
            slideXmlString = replaceGraphicGroup(slideXmlString, "Graphic 21", footerGroup);
          }
        }
        zip.file(slidePath, slideXmlString);

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
      const slideXmlString = await slideFile.async("string");
      const slideXml = await parseStringPromise(slideXmlString);
      const relsFile = zip.file(relsPath);
      const relsXml = relsFile
        ? await parseStringPromise(await relsFile.async("string"))
        : undefined;
      const placeholders = buildPlaceholderMap(slideXml);

      prototypes[layout as SlideLayoutType] = {
        slideNumber,
        slideXml,
        relsXml,
        rawXml: slideXmlString,
        placeholders,
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

function buildPlaceholderMap(slideXml: any): PlaceholderMap {
  const map: PlaceholderMap = {
    byType: {},
    byTypeIdx: {},
  };

  const spTree = slideXml?.["p:sld"]?.["p:cSld"]?.[0]?.["p:spTree"]?.[0];
  if (!spTree) {
    return map;
  }

  const shapes: PlaceholderInfo[] = [];
  collectPlaceholderInfo(spTree, shapes);

  shapes.forEach(info => {
    if (!info.placeholderType) return;
    const type = info.placeholderType;
    if (!map.byType[type]) {
      map.byType[type] = [];
    }
    map.byType[type]?.push(info.name);

    if (typeof info.placeholderIdx === "number") {
      if (!map.byTypeIdx[type]) {
        map.byTypeIdx[type] = {};
      }
      map.byTypeIdx[type]![info.placeholderIdx] = info.name;
    }
  });

  return map;
}

function collectPlaceholderInfo(node: any, acc: PlaceholderInfo[]): void {
  const shapes = node?.["p:sp"] ?? [];
  shapes.forEach((shape: any) => {
    const nvSpPr = shape?.["p:nvSpPr"]?.[0];
    const cNvPr = nvSpPr?.["p:cNvPr"]?.[0];
    const name = cNvPr?.$?.name;
    if (!name) return;

    const placeholder = nvSpPr?.["p:nvPr"]?.[0]?.["p:ph"]?.[0]?.$;
    const placeholderType = placeholder?.type;
    const placeholderIdx =
      placeholder?.idx !== undefined ? Number.parseInt(placeholder.idx, 10) : undefined;

    acc.push({ name, placeholderType, placeholderIdx });
  });

  const groupShapes = node?.["p:grpSp"] ?? [];
  groupShapes.forEach((group: any) => collectPlaceholderInfo(group, acc));
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
      logger.error("Failed to load logo - PPTX will use template default logo");
      return;
    }

    const targetFile = "ppt/media/image2.jpg";

    // CRITICAL: Check if logo slot exists in template
    if (!zip.file(targetFile)) {
      logger.error(`Expected logo slot ${targetFile} missing in template; cannot replace logo.`);
      return;
    }

    // ALWAYS replace the logo, don't check if it's the same
    // This ensures we always use the freshly loaded logo
    zip.file(targetFile, logoBuffer);
    logger.info(`Replaced template logo with ${theme} WHITE logo (${logoBuffer.length} bytes)`);

    // Log logo info for debugging
    const existing = await zip.file(targetFile)?.async("nodebuffer").catch(() => null);
    if (existing) {
      logger.info(`Verified logo replacement: ${existing.length} bytes in final PPTX`);
    }
  } catch (error) {
    logger.error(`CRITICAL: Failed to replace template logo with ${theme} theme variant:`, error);
  }
}

async function updateTitleSlide(zip: JSZip, data: PresentationData): Promise<void> {
  const slidePath = "ppt/slides/slide1.xml";
  const slideFile = zip.file(slidePath);

  if (!slideFile) {
    throw new Error("Template does not include a title slide");
  }

  const slideXmlString = await slideFile.async("string");
  const preservedLogoGroup = extractGraphicGroup(slideXmlString, "Graphic 21");
  const slide = await parseStringPromise(slideXmlString);
  setShapeLines(slide, "Title 1", [
    { text: data.title, style: { color: "FFFFFF", size: 4000, bold: true, align: "left" as const } },
  ]);

  if (data.subtitle) {
    setShapeLines(slide, "TextBox 45", [
      { text: data.subtitle, style: { color: "FFFFFF", size: 2400, align: "left" as const } },
    ]);
  } else if (data.author) {
    setShapeLines(slide, "TextBox 45", [
      { text: data.author, style: { color: "FFFFFF", size: 2400, align: "left" as const } },
    ]);
  } else {
    clearShapeText(slide, "TextBox 45");
  }

  softenShapeFill(slide, "Freeform 31", { opacity: 0.25 });
  softenShapeFill(slide, "Freeform 18", { opacity: 0.18 });

  let updatedSlideXml = builder.buildObject(slide);
  if (preservedLogoGroup) {
    updatedSlideXml = replaceGraphicGroup(updatedSlideXml, "Graphic 21", preservedLogoGroup);
  }
  zip.file(slidePath, updatedSlideXml);
}

async function resetExistingSlides(
  zip: JSZip,
  presentation: any,
  presentationRels: any,
  contentTypes: any,
): Promise<void> {
  for (const fileName of Object.keys(zip.files)) {
    if (
      /^ppt\/slides\/slide\d+\.xml$/.test(fileName) &&
      fileName !== "ppt/slides/slide1.xml"
    ) {
      zip.remove(fileName);
      continue;
    }

    const slideRelsMatch = fileName.match(
      /^ppt\/slides\/_rels\/slide(\d+)\.xml\.rels$/,
    );
    if (slideRelsMatch && slideRelsMatch[1] !== "1") {
      zip.remove(fileName);
      continue;
    }

    const notesMatch = fileName.match(/^ppt\/notesSlides\/notesSlide(\d+)\.xml$/);
    if (notesMatch && notesMatch[1] !== "1") {
      zip.remove(fileName);
      continue;
    }

    const notesRelsMatch = fileName.match(
      /^ppt\/notesSlides\/_rels\/notesSlide(\d+)\.xml\.rels$/,
    );
    if (notesRelsMatch && notesRelsMatch[1] !== "1") {
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
  context: { includeFooter: boolean; prototype: SlidePrototype },
): void {
  const blueprint = getLayoutBlueprint("section-break");
  const { prototype } = context;
  const placeholders = prototype.placeholders;

  const titleShape = resolveShapeTarget(
    slideXml,
    placeholders,
    blueprint.shapes.title,
    ["Title 5"],
  );
  setShapeLinesSafe(slideXml, titleShape, [
    { text: slideData.title, style: { size: 3400, bold: true, color: "#101D41", align: "left" as const } },
  ]);

  const descriptionShape = resolveShapeTarget(
    slideXml,
    placeholders,
    blueprint.shapes.description,
    ["TextBox 7"],
  );
  if (slideData.description) {
    setShapeLinesSafe(slideXml, descriptionShape, [
      { text: slideData.description, style: { align: "left" as const, size: 2200 } },
    ]);
  } else {
    clearShapeTextSafe(slideXml, descriptionShape);
  }

  const highlightShape = resolveShapeTarget(
    slideXml,
    placeholders,
    blueprint.shapes.highlights,
    ["TextBox 8"],
  );
  const highlightConstraint = applyListConstraint(
    slideData.highlights,
    blueprint.constraints?.highlights?.maxItems,
  );
  if (highlightConstraint.truncated) {
    logTruncation("section-break", "highlights", highlightConstraint.removed);
  }

  if (highlightConstraint.values.length > 0) {
    const highlightLines: TextRunInput[] = highlightConstraint.values.flatMap(
      (point, index, array): TextRunInput[] => [
        { text: point, style: { align: "left" as const } },
        ...(index < array.length - 1
          ? [{ text: " ", style: { bullet: false } }] as TextRunInput[]
          : []),
      ],
    );
    setShapeLinesSafe(slideXml, highlightShape, highlightLines);
  } else {
    clearShapeTextSafe(slideXml, highlightShape);
  }

  softenShapeFill(slideXml, "Graphic 37", { opacity: 0.08 });
}

function populateBulletSlide(
  slideXml: any,
  slideData: BulletSlide,
  context: { includeFooter: boolean; prototype: SlidePrototype },
): void {
  const blueprint = getLayoutBlueprint("bullets");
  const { includeFooter, prototype } = context;
  const placeholders = prototype.placeholders;

  const eyebrowShape = resolveShapeTarget(
    slideXml,
    placeholders,
    blueprint.shapes.eyebrow,
    ["TextBox 27"],
  );
  if (slideData.eyebrow) {
    setShapeLinesSafe(slideXml, eyebrowShape, [
      { text: slideData.eyebrow, style: { align: "left" as const, size: 2000, color: "#2C4A78" } },
    ]);
  } else {
    clearShapeTextSafe(slideXml, eyebrowShape);
  }

  const titleShape = resolveShapeTarget(
    slideXml,
    placeholders,
    blueprint.shapes.title,
    ["TextBox 14"],
  );
  setShapeLinesSafe(slideXml, titleShape, [
    { text: slideData.title, style: { align: "left" as const, size: 3200, bold: true, color: "#101D41" } },
  ]);

  const bulletConstraint = applyListConstraint(
    slideData.bullets,
    blueprint.constraints?.bullets?.maxItems,
  );
  if (bulletConstraint.truncated) {
    logTruncation("bullets", "primary bullets", bulletConstraint.removed);
  }

  const bulletBodyShape = resolveShapeTarget(
    slideXml,
    placeholders,
    blueprint.shapes.body,
    ["TextBox 13"],
  );
  setShapeLinesSafe(
    slideXml,
    bulletBodyShape,
    bulletConstraint.values.map((bullet): TextRunInput => ({ text: bullet, style: { align: "left" as const } })),
  );

  const supportingConstraint = applyListConstraint(
    slideData.supportingPoints,
    blueprint.constraints?.supporting?.maxItems,
  );
  if (supportingConstraint.truncated) {
    logTruncation("bullets", "supporting points", supportingConstraint.removed);
  }

  const supportingShape = resolveShapeTarget(
    slideXml,
    placeholders,
    blueprint.shapes.supporting,
    ["TextBox 11"],
  );
  if (supportingConstraint.values.length > 0) {
    setShapeLinesSafe(
      slideXml,
      supportingShape,
      supportingConstraint.values.map((point): TextRunInput => ({ text: point, style: { align: "left" as const } })),
    );
  } else {
    clearShapeTextSafe(slideXml, supportingShape);
  }

  const footnoteDescriptors = blueprint.footnoteShapes ?? [];
  const kickerLeftShape = resolveShapeTarget(
    slideXml,
    placeholders,
    footnoteDescriptors[0],
    ["TextBox 4"],
  );
  const kickerRightShape = resolveShapeTarget(
    slideXml,
    placeholders,
    footnoteDescriptors[1],
    ["TextBox 5"],
  );
  const footerFallbacks = [kickerLeftShape, kickerRightShape].filter(Boolean) as string[];

  if (includeFooter) {
    if (slideData.kickerLeft) {
      setShapeLinesSafe(slideXml, kickerLeftShape, [
        { text: slideData.kickerLeft, style: { align: "left" as const, size: 2000, color: "#2C4A78" } },
      ]);
    } else {
      clearShapeTextSafe(slideXml, kickerLeftShape);
    }
    if (slideData.kickerRight) {
      setShapeLinesSafe(slideXml, kickerRightShape, [
        { text: slideData.kickerRight, style: { align: "right" as const, size: 2000, color: "#2C4A78" } },
      ]);
    } else {
      clearShapeTextSafe(slideXml, kickerRightShape);
    }
  } else {
    stripFooterDecorations(slideXml, placeholders, footerFallbacks);
  }
}

function populateTwoColumnSlide(
  slideXml: any,
  slideData: TwoColumnSlide,
  context: { includeFooter: boolean; prototype: SlidePrototype },
): void {
  const blueprint = getLayoutBlueprint("two-column");
  const { includeFooter, prototype } = context;
  const placeholders = prototype.placeholders;

  const titleShape = resolveShapeTarget(
    slideXml,
    placeholders,
    blueprint.shapes.title,
    ["TextBox 14"],
  );
  setShapeLinesSafe(slideXml, titleShape, [
    { text: slideData.title, style: { align: "left" as const, size: 3200, bold: true, color: "#101D41" } },
  ]);

  const leftConstraint = applyListConstraint(
    slideData.leftColumn,
    blueprint.constraints?.leftColumn?.maxItems,
  );
  if (leftConstraint.truncated) {
    logTruncation("two-column", "left column", leftConstraint.removed);
  }

  const leftShape = resolveShapeTarget(
    slideXml,
    placeholders,
    blueprint.shapes.leftColumn,
    ["TextBox 13"],
  );
  setShapeLinesSafe(
    slideXml,
    leftShape,
    leftConstraint.values.map((item): TextRunInput => ({ text: item, style: { align: "left" as const } })),
  );

  const rightConstraint = applyListConstraint(
    slideData.rightColumn,
    blueprint.constraints?.rightColumn?.maxItems,
  );
  if (rightConstraint.truncated) {
    logTruncation("two-column", "right column", rightConstraint.removed);
  }

  const rightLines: TextRunInput[] = [];
  if (slideData.rightTitle) {
    rightLines.push({ text: slideData.rightTitle, style: { bullet: false, bold: true, size: 2400, align: "left" as const } });
    rightLines.push({ text: " ", style: { bullet: false } });
  }
  rightLines.push(
    ...rightConstraint.values.map((item): TextRunInput => ({ text: item, style: { align: "left" as const } })),
  );
  const rightShape = resolveShapeTarget(
    slideXml,
    placeholders,
    blueprint.shapes.rightColumn,
    ["TextBox 11"],
  );
  setShapeLinesSafe(slideXml, rightShape, rightLines);

  const eyebrowShape = resolveShapeTarget(
    slideXml,
    placeholders,
    blueprint.shapes.eyebrow,
    ["TextBox 4"],
  );
  if (slideData.eyebrow) {
    setShapeLinesSafe(slideXml, eyebrowShape, [
      { text: slideData.eyebrow, style: { align: "left" as const, size: 2000, color: "#2C4A78" } },
    ]);
  } else {
    clearShapeTextSafe(slideXml, eyebrowShape);
  }

  const footnoteDescriptors = blueprint.footnoteShapes ?? [];
  const footerLeftShape = resolveShapeTarget(
    slideXml,
    placeholders,
    footnoteDescriptors[0],
    ["TextBox 4"],
  );
  const footerRightShape = resolveShapeTarget(
    slideXml,
    placeholders,
    footnoteDescriptors[1],
    ["TextBox 5"],
  );
  const footerFallbacks = [footerLeftShape, footerRightShape].filter(Boolean) as string[];

  if (!includeFooter) {
    stripFooterDecorations(slideXml, placeholders, footerFallbacks);
  }
}

function populateKpiGridSlide(
  slideXml: any,
  slideData: KpiGridSlide,
  context: { includeFooter: boolean; prototype: SlidePrototype },
): void {
  const blueprint = getLayoutBlueprint("kpi-grid");
  const { includeFooter, prototype } = context;
  const placeholders = prototype.placeholders;

  const titleShape = resolveShapeTarget(
    slideXml,
    placeholders,
    blueprint.shapes.title,
    ["TextBox 14"],
  );
  setShapeLinesSafe(slideXml, titleShape, [
    { text: slideData.title, style: { align: "left" as const, size: 3200, bold: true, color: "#101D41" } },
  ]);

  const summaryCalloutShape = resolveShapeTarget(
    slideXml,
    placeholders,
    blueprint.shapes.summaryCallout,
    ["Rounded Rectangle 35"],
  );
  const summaryTextShape = resolveShapeTarget(
    slideXml,
    placeholders,
    blueprint.shapes.summaryText,
    ["TextBox 13"],
  );
  if (slideData.summary) {
    setShapeLinesSafe(slideXml, summaryCalloutShape, [
      { text: slideData.summary, style: { align: "left" as const, size: 2200, color: "#2C4A78" } },
    ]);
    setShapeLinesSafe(slideXml, summaryTextShape, [
      { text: slideData.summary, style: { align: "left" as const, size: 2200 } },
    ]);
  } else {
    clearShapeTextSafe(slideXml, summaryCalloutShape);
    clearShapeTextSafe(slideXml, summaryTextShape);
  }

  const metricShapes = blueprint.metricShapes ?? ["TextBox 30", "TextBox 28", "TextBox 26"];
  const metrics = (slideData.metrics || []).slice(0, metricShapes.length);

  metricShapes.forEach((shapeName, index) => {
    const metric = metrics[index];
    if (!metric) {
      clearShapeText(slideXml, shapeName);
      return;
    }

    resizeShape(slideXml, shapeName, { heightMultiplier: 1.18 });

    const metricLines: TextRunInput[] = [
      { text: metric.value, style: { size: 3200, bold: true, align: "left" as const } },
      { text: metric.label, style: { align: "left" as const, size: 2200, color: "#1B425D" } },
    ];

    if (metric.delta) {
      metricLines.push({ text: `Δ ${metric.delta}`, style: { align: "left" as const, color: "#2C7A4B" } });
    }
    if (metric.description) {
      metricLines.push({ text: metric.description, style: { align: "left" as const } });
    }

    setShapeLines(slideXml, shapeName, metricLines);
  });

  const footnoteDescriptors = blueprint.footnoteShapes ?? [];
  const footerShape = resolveShapeTarget(
    slideXml,
    placeholders,
    footnoteDescriptors[0],
    ["TextBox 4"],
  );
  const secondaryFooterShape = resolveShapeTarget(
    slideXml,
    placeholders,
    footnoteDescriptors[1],
    ["TextBox 5"],
  );
  const footerFallbacks = [footerShape, secondaryFooterShape].filter(Boolean) as string[];

  if (slideData.footnotes && slideData.footnotes.length > 0 && includeFooter) {
    const formatted = slideData.footnotes.map((note, idx): TextRunInput => ({
      text: `${idx + 1}. ${note}`,
      style: { align: "left" as const, bullet: false, size: 1800 },
    }));
    setShapeLinesSafe(slideXml, footerShape, formatted);
    clearShapeTextSafe(slideXml, secondaryFooterShape);
  } else if (!includeFooter) {
    stripFooterDecorations(slideXml, placeholders, footerFallbacks);
  } else {
    clearShapeTextSafe(slideXml, footerShape);
    clearShapeTextSafe(slideXml, secondaryFooterShape);
  }
}

function populateQuoteSlide(
  slideXml: any,
  slideData: QuoteSlide,
  context: { includeFooter: boolean; prototype: SlidePrototype },
): void {
  const blueprint = getLayoutBlueprint("quote");
  const { includeFooter, prototype } = context;
  const placeholders = prototype.placeholders;

  const titleShape = resolveShapeTarget(
    slideXml,
    placeholders,
    blueprint.shapes.title,
    ["TextBox 1"],
  );
  setShapeTextSafe(slideXml, titleShape, slideData.title || "");

  const eyebrowShape = resolveShapeTarget(
    slideXml,
    placeholders,
    blueprint.shapes.eyebrow,
    ["TextBox 14"],
  );
  if (slideData.eyebrow) {
    setShapeTextSafe(slideXml, eyebrowShape, slideData.eyebrow);
  } else {
    clearShapeTextSafe(slideXml, eyebrowShape);
  }

  const quoteShape = resolveShapeTarget(
    slideXml,
    placeholders,
    blueprint.shapes.quote,
    ["TextBox 43"],
  );
  setShapeLinesSafe(slideXml, quoteShape, wrapQuote(slideData.quote));

  const attributionShape = resolveShapeTarget(
    slideXml,
    placeholders,
    blueprint.shapes.attribution,
    ["TextBox 6"],
  );
  if (slideData.attribution) {
    setShapeTextSafe(slideXml, attributionShape, slideData.attribution);
  } else {
    clearShapeTextSafe(slideXml, attributionShape);
  }

  if (slideData.supportingPoints && slideData.supportingPoints.length > 0) {
    setShapeLinesSafe(slideXml, quoteShape, [
      ...wrapQuote(slideData.quote),
      "",
      ...slideData.supportingPoints,
    ]);
  }

  const footnoteDescriptors = blueprint.footnoteShapes ?? [];
  const footerLeft = resolveShapeTarget(
    slideXml,
    placeholders,
    footnoteDescriptors[0],
    ["TextBox 4"],
  );
  const footerRight = resolveShapeTarget(
    slideXml,
    placeholders,
    footnoteDescriptors[1],
    ["TextBox 5"],
  );
  const footerFallbacks = [footerLeft, footerRight].filter(Boolean) as string[];

  if (!includeFooter) {
    stripFooterDecorations(slideXml, placeholders, footerFallbacks);
  }
}

function populateComparisonSlide(
  slideXml: any,
  slideData: ComparisonSlide,
  context: { includeFooter: boolean; prototype: SlidePrototype },
): void {
  const blueprint = getLayoutBlueprint("comparison");
  const { includeFooter, prototype } = context;
  const placeholders = prototype.placeholders;

  const titleShape = resolveShapeTarget(
    slideXml,
    placeholders,
    blueprint.shapes.title,
    ["TextBox 14"],
  );
  setShapeTextSafe(slideXml, titleShape, slideData.title);

  const eyebrowShape = resolveShapeTarget(
    slideXml,
    placeholders,
    blueprint.shapes.eyebrow,
    ["TextBox 1"],
  );
  if (slideData.eyebrow) {
    setShapeTextSafe(slideXml, eyebrowShape, slideData.eyebrow);
  } else {
    clearShapeTextSafe(slideXml, eyebrowShape);
  }

  const summaryShape = resolveShapeTarget(
    slideXml,
    placeholders,
    blueprint.shapes.summaryText,
    ["TextBox 13"],
  );
  if (slideData.summary) {
    setShapeTextSafe(slideXml, summaryShape, slideData.summary);
  } else {
    clearShapeTextSafe(slideXml, summaryShape);
  }

  const summaryCalloutShape = resolveShapeTarget(
    slideXml,
    placeholders,
    blueprint.shapes.summaryCallout,
    ["Rounded Rectangle 39"],
  );
  if (slideData.tableTitle) {
    setShapeTextSafe(slideXml, summaryCalloutShape, slideData.tableTitle);
  } else {
    clearShapeTextSafe(slideXml, summaryCalloutShape);
  }

  const headingShapes = blueprint.columnHeadingShapes ?? ["TextBox 31", "TextBox 32", "TextBox 33"];
  const bodyShapes = blueprint.columnBodyShapes ?? ["TextBox 34", "TextBox 35", "TextBox 38"];

  headingShapes.forEach((shapeName, index) => {
    const column = slideData.columns[index];
    if (column) {
      setShapeTextSafe(slideXml, shapeName, column.title);
      setShapeLinesSafe(slideXml, bodyShapes[index], column.bullets);
    } else {
      clearShapeTextSafe(slideXml, shapeName);
      clearShapeTextSafe(slideXml, bodyShapes[index]);
    }
  });

  const footnoteDescriptors = blueprint.footnoteShapes ?? [];
  const footnoteNames = footnoteDescriptors
    .map(descriptor => resolveShapeTarget(slideXml, placeholders, descriptor))
    .filter(Boolean) as string[];

  if (slideData.footnotes && includeFooter) {
    footnoteNames.forEach((shapeName, index) => {
      const note = slideData.footnotes?.[index];
      if (note) {
        setShapeTextSafe(slideXml, shapeName, note);
      } else {
        clearShapeTextSafe(slideXml, shapeName);
      }
    });
  } else {
    footnoteNames.forEach(shapeName => clearShapeTextSafe(slideXml, shapeName));
    if (!includeFooter) {
      stripFooterDecorations(slideXml, placeholders, footnoteNames);
    }
  }
}

function populateTimelineSlide(
  slideXml: any,
  slideData: TimelineSlide,
  context: { includeFooter: boolean; prototype: SlidePrototype },
): void {
  const blueprint = getLayoutBlueprint("timeline");
  const { includeFooter, prototype } = context;
  const placeholders = prototype.placeholders;

  const titleShape = resolveShapeTarget(
    slideXml,
    placeholders,
    blueprint.shapes.title,
    ["TextBox 5"],
  );
  setShapeTextSafe(slideXml, titleShape, slideData.title);

  const milestoneConstraint = applyObjectListConstraint(
    slideData.milestones,
    blueprint.constraints?.milestones?.maxItems,
  );
  if (milestoneConstraint.truncated) {
    logTruncation("timeline", "milestones", milestoneConstraint.removed);
  }

  const milestoneLines = [
    ...(slideData.summary ? [slideData.summary] : []),
    ...milestoneConstraint.values.map((milestone) => {
      const segments = [
        milestone.date,
        milestone.title,
        milestone.description,
      ].filter(Boolean);
      return segments.join(" - ");
    }),
  ];

  if (milestoneConstraint.truncated) {
    milestoneLines.push("…");
  }

  const bodyShape = resolveShapeTarget(
    slideXml,
    placeholders,
    blueprint.shapes.timelineBody,
    ["Text Placeholder 12"],
  );
  setShapeLinesSafe(slideXml, bodyShape, milestoneLines);

  const footnoteDescriptors = blueprint.footnoteShapes ?? [];
  const footnoteNames = footnoteDescriptors
    .map(descriptor => resolveShapeTarget(slideXml, placeholders, descriptor))
    .filter(Boolean) as string[];

  if (includeFooter && slideData.footnotes) {
    footnoteNames.forEach((shapeName, index) => {
      const value = slideData.footnotes?.[index];
      if (value) {
        setShapeTextSafe(slideXml, shapeName, value);
      } else {
        clearShapeTextSafe(slideXml, shapeName);
      }
    });
  } else {
    footnoteNames.forEach(shapeName => clearShapeTextSafe(slideXml, shapeName));
    if (!includeFooter) {
      stripFooterDecorations(slideXml, placeholders, footnoteNames);
    }
  }
}

function wrapQuote(quote: string): TextRunInput[] {
  const trimmed = quote.trim();
  if (!trimmed) return [""];
  return [`"${trimmed}"`];
}

const DEFAULT_FOOTER_FALLBACK_SHAPES = ["TextBox 4", "TextBox 5"];

function resolvePlaceholderName(
  placeholders: PlaceholderMap,
  fallbackNames: string[],
  candidates: Array<{ type: string; index?: number }> = [],
): string | null {
  for (const candidate of candidates) {
    if (typeof candidate.index === "number") {
      const byIdx = placeholders.byTypeIdx[candidate.type]?.[candidate.index];
      if (byIdx) {
        return byIdx;
      }
    }
    const byType = placeholders.byType[candidate.type];
    if (byType && byType.length > 0) {
      if (typeof candidate.index === "number") {
        const specific = byType[candidate.index];
        if (specific) {
          return specific;
        }
      } else {
        return byType[0];
      }
    }
  }

  for (const name of fallbackNames) {
    if (name) {
      return name;
    }
  }

  return null;
}

function getLayoutBlueprint(layout: SlideLayoutType): LayoutBlueprint {
  return LAYOUT_BLUEPRINTS[layout];
}

function resolveShapeTarget(
  slideXml: any,
  placeholders: PlaceholderMap,
  descriptor?: ShapeTargetDescriptor,
  fallbackNames: string[] = [],
): string | null {
  const combinedFallbacks = [
    ...(descriptor?.fallbacks ?? []),
    ...fallbackNames,
  ];

  if (descriptor?.name) {
    return descriptor.name;
  }

  if (descriptor?.names) {
    for (const candidate of descriptor.names) {
      if (candidate && findShapeByName(slideXml, candidate)) {
        return candidate;
      }
    }
  }

  if (descriptor?.placeholder) {
    const resolved = resolvePlaceholderName(
      placeholders,
      combinedFallbacks,
      [{ type: descriptor.placeholder.type, index: descriptor.placeholder.index }],
    );
    if (resolved) {
      return resolved;
    }
  }

  for (const candidate of descriptor?.fallbacks ?? []) {
    if (candidate && findShapeByName(slideXml, candidate)) {
      return candidate;
    }
  }

  return resolvePlaceholderName(placeholders, combinedFallbacks);
}

interface ListConstraintResult<T> {
  values: T[];
  truncated: boolean;
  removed: number;
}

function applyListConstraint(
  items: string[] | undefined,
  maxItems?: number,
  options: { appendEllipsis?: boolean } = { appendEllipsis: true },
): ListConstraintResult<string> {
  if (!items || items.length === 0) {
    return { values: [], truncated: false, removed: 0 };
  }

  if (!maxItems || items.length <= maxItems) {
    return { values: [...items], truncated: false, removed: 0 };
  }

  const trimmed = items.slice(0, maxItems);
  if (options.appendEllipsis !== false && trimmed.length > 0) {
    trimmed[trimmed.length - 1] = `${trimmed[trimmed.length - 1]} …`;
  }

  return {
    values: trimmed,
    truncated: true,
    removed: items.length - trimmed.length,
  };
}

function applyObjectListConstraint<T>(
  items: T[] | undefined,
  maxItems?: number,
): ListConstraintResult<T> {
  if (!items || items.length === 0) {
    return { values: [], truncated: false, removed: 0 };
  }

  if (!maxItems || items.length <= maxItems) {
    return { values: [...items], truncated: false, removed: 0 };
  }

  const trimmed = items.slice(0, maxItems);
  return {
    values: trimmed,
    truncated: true,
    removed: items.length - trimmed.length,
  };
}

function logTruncation(
  layout: SlideLayoutType,
  contentArea: string,
  removedCount: number,
): void {
  logger.info(
    `[pptx:${layout}] truncated ${removedCount} item(s) in ${contentArea} to fit template density`,
  );
}

function stripFooterDecorations(
  slideXml: any,
  placeholders: PlaceholderMap,
  fallbackNames: string[] = DEFAULT_FOOTER_FALLBACK_SHAPES,
): void {
  const targetNames = new Set<string>();
  ["ftr", "dt", "sldNum"].forEach(type => {
    placeholders.byType[type]?.forEach(name => targetNames.add(name));
  });
  fallbackNames.forEach(name => targetNames.add(name));

  targetNames.forEach(name => clearShapeText(slideXml, name));
}

function setShapeLinesSafe(
  slideXml: any,
  shapeName: string | null | undefined,
  lines: TextRunInput[],
): void {
  if (!shapeName) return;
  setShapeLines(slideXml, shapeName, lines);
}

function setShapeTextSafe(
  slideXml: any,
  shapeName: string | null | undefined,
  text: string,
): void {
  if (!shapeName) return;
  setShapeText(slideXml, shapeName, text);
}

function clearShapeTextSafe(slideXml: any, shapeName: string | null | undefined): void {
  if (!shapeName) return;
  clearShapeText(slideXml, shapeName);
}

function setShapeLines(slideXml: any, shapeName: string, lines: TextRunInput[]): void {
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

function buildParagraph(basePara: any, input: TextRunInput): any {
  const paragraph: any = {};

  // Extract text and style from input
  const text = typeof input === "string" ? input : input.text;
  const style = typeof input === "string" ? undefined : input.style;

  // Set paragraph properties (alignment, bullet, etc.)
  if (basePara["a:pPr"]) {
    paragraph["a:pPr"] = [deepClone(basePara["a:pPr"][0])];

    // Apply alignment if specified
    if (style?.align) {
      if (!paragraph["a:pPr"][0]) {
        paragraph["a:pPr"] = [{}];
      }
      paragraph["a:pPr"][0]["$"] = paragraph["a:pPr"][0]["$"] || {};
      paragraph["a:pPr"][0]["$"]["algn"] = style.align;
    }

    // Handle bullet setting
    if (style?.bullet === false) {
      if (!paragraph["a:pPr"][0]) {
        paragraph["a:pPr"] = [{}];
      }
      paragraph["a:pPr"][0]["a:buNone"] = [{}];
    }
  }

  // Build the text run
  const run: any = { "a:t": [text] };

  // Apply text run properties (font, size, color, bold)
  if (basePara["a:r"]?.[0]?.["a:rPr"]) {
    run["a:rPr"] = [deepClone(basePara["a:r"][0]["a:rPr"][0])];
  } else {
    run["a:rPr"] = [{}];
  }

  // Apply style properties
  if (style) {
    if (!run["a:rPr"][0]) {
      run["a:rPr"] = [{}];
    }

    if (style.size) {
      run["a:rPr"][0]["$"] = run["a:rPr"][0]["$"] || {};
      run["a:rPr"][0]["$"]["sz"] = style.size.toString();
    }

    if (style.bold) {
      run["a:rPr"][0]["$"] = run["a:rPr"][0]["$"] || {};
      run["a:rPr"][0]["$"]["b"] = "1";
    }

    if (style.color) {
      const colorValue = style.color.startsWith("#") ? style.color.slice(1) : style.color;
      run["a:rPr"][0]["a:solidFill"] = [
        {
          "a:srgbClr": [
            {
              $: { val: colorValue }
            }
          ]
        }
      ];
    }
  }

  if (!run["a:rPr"][0]) {
    run["a:rPr"] = [{}];
  }
  run["a:rPr"][0]["a:latin"] = [
    {
      $: { typeface: "Aptos" },
    },
  ];
  run["a:rPr"][0]["a:ea"] = [
    {
      $: { typeface: "Aptos" },
    },
  ];
  run["a:rPr"][0]["a:cs"] = [
    {
      $: { typeface: "Aptos" },
    },
  ];

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
