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

const LAYOUT_IMPLEMENTATIONS: Record<SlideLayoutType, LayoutImplementation> = {
  "section-break": {
    populate: (slideXml, slideData) =>
      populateSectionBreakSlide(slideXml, slideData as SectionBreakSlide),
  },
  bullets: {
    populate: (slideXml, slideData, options) =>
      populateBulletSlide(slideXml, slideData as BulletSlide, options),
  },
  "two-column": {
    populate: (slideXml, slideData, options) =>
      populateTwoColumnSlide(slideXml, slideData as TwoColumnSlide, options),
  },
  "kpi-grid": {
    populate: (slideXml, slideData, options) =>
      populateKpiGridSlide(slideXml, slideData as KpiGridSlide, options),
  },
  quote: {
    populate: (slideXml, slideData, options) =>
      populateQuoteSlide(slideXml, slideData as QuoteSlide, options),
  },
  comparison: {
    populate: (slideXml, slideData, options) =>
      populateComparisonSlide(slideXml, slideData as ComparisonSlide, options),
  },
  timeline: {
    populate: (slideXml, slideData, options) =>
      populateTimelineSlide(slideXml, slideData as TimelineSlide, options),
  },
};

export async function generatePPTXFromTemplate(
  data: PresentationData,
  options: TemplateOptions = {},
): Promise<Buffer> {
  const { theme = "healthrise", includeFooter = true } = options;

  logger.info(
    `Generating PPTX from Healthrise template with ${data.slides.length} content slides`,
  );

  const templateBuffer = await fs.readFile(TEMPLATE_PATH);
  const zip = await JSZip.loadAsync(templateBuffer);

  const layoutPrototypes = await loadLayoutPrototypes(zip);
  const notesPrototype = await loadNotesPrototype(zip);

  const [presentation, presentationRels, contentTypes] = await Promise.all([
    parseXml(zip, "ppt/presentation.xml"),
    parseXml(zip, "ppt/_rels/presentation.xml.rels"),
    parseXml(zip, "[Content_Types].xml"),
  ]);

  await applyTheme(zip, theme);
  await ensureBrandAssets(zip);

  await updateTitleSlide(zip, data);

  await resetExistingSlides(zip, presentation, presentationRels, contentTypes);

  let nextSlideNumber = 2;
  let nextRelationshipId = determineNextRelationshipId(presentationRels);

  for (const slideData of data.slides) {
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
  }

  zip.file("ppt/presentation.xml", builder.buildObject(presentation));
  zip.file(
    "ppt/_rels/presentation.xml.rels",
    builder.buildObject(presentationRels),
  );
  zip.file("[Content_Types].xml", builder.buildObject(contentTypes));

  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });

  logger.info(
    `Finished generating PPTX (${nextSlideNumber - 1} slides, ${buffer.length} bytes)`,
  );

  return buffer;
}

async function parseXml(zip: JSZip, pathName: string): Promise<any> {
  const file = zip.file(pathName);
  if (!file) {
    throw new Error(`Template missing expected part: ${pathName}`);
  }
  return parseStringPromise(await file.async("string"));
}

async function loadLayoutPrototypes(zip: JSZip) {
  const prototypes: Partial<Record<SlideLayoutType, SlidePrototype>> = {};

  for (const [layout, slideNumber] of Object.entries(LAYOUT_SOURCE_SLIDES)) {
    const slidePath = `ppt/slides/slide${slideNumber}.xml`;
    const relsPath = `ppt/slides/_rels/slide${slideNumber}.xml.rels`;

    const slideFile = zip.file(slidePath);
    if (!slideFile) {
      throw new Error(`Missing template slide ${slideNumber} for layout ${layout}`);
    }

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

async function applyTheme(zip: JSZip, theme: ThemeOption) {
  if (theme === "healthrise") {
    return;
  }

  const sourceThemeFile =
    theme === "light" ? "ppt/theme/theme2.xml" : "ppt/theme/theme2.xml";
  const targetThemeFile = "ppt/theme/theme1.xml";

  const source = zip.file(sourceThemeFile);
  const target = zip.file(targetThemeFile);

  if (!source || !target) {
    logger.warn(`Unable to switch theme – falling back to default ${theme}`);
    return;
  }

  const themeContent = await source.async("string");
  zip.file(targetThemeFile, themeContent);
}

async function ensureBrandAssets(zip: JSZip) {
  try {
    const logoBuffer = await loadWhiteLogoAsJpeg();
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
    logger.info("Updated template logo with white variant.");
  } catch (error) {
    logger.warn("Failed to refresh template logo with white variant:", error);
  }
}

async function updateTitleSlide(zip: JSZip, data: PresentationData) {
  const slidePath = "ppt/slides/slide1.xml";
  const slideFile = zip.file(slidePath);

  if (!slideFile) {
    throw new Error("Template does not include a title slide");
  }

  const slide = await parseStringPromise(await slideFile.async("string"));
  setShapeText(slide, "Title 1", data.title);

  if (data.subtitle) {
    setShapeText(slide, "TextBox 45", data.subtitle);
  } else if (data.author) {
    setShapeText(slide, "TextBox 45", data.author);
  } else {
    clearShapeText(slide, "TextBox 45");
  }

  zip.file(slidePath, builder.buildObject(slide));
}

async function resetExistingSlides(
  zip: JSZip,
  presentation: any,
  presentationRels: any,
  contentTypes: any,
) {
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
  return relationships.reduce((max: number, rel: any) => {
    const match = rel.$.Id.match(/^rId(\d+)$/);
    if (!match) return max;
    return Math.max(max, Number.parseInt(match[1], 10));
  }, 0);
}

function addSlideToPresentation(
  presentation: any,
  presentationRels: any,
  slideNumber: number,
  relationshipId: number,
) {
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

function addSlideOverride(contentTypes: any, slideNumber: number) {
  contentTypes.Types.Override = contentTypes.Types.Override || [];
  contentTypes.Types.Override.push({
    $: {
      PartName: `/ppt/slides/slide${slideNumber}.xml`,
      ContentType:
        "application/vnd.openxmlformats-officedocument.presentationml.slide+xml",
    },
  });
}

function addNotesOverride(contentTypes: any, slideNumber: number) {
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
) {
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

function updateSlideNotesRelationship(relsXml: any, slideNumber: number) {
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

function removeNotesRelationship(relsXml: any) {
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
) {
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

function updateNoteRelationship(relsXml: any, slideNumber: number) {
  relsXml.Relationships.Relationship = (relsXml.Relationships.Relationship || []).map(
    (rel: any) => {
      if (rel.$.Type === SLIDE_REL_TYPE) {
        rel.$.Target = `../slides/slide${slideNumber}.xml`;
      }
      return rel;
    },
  );
}

function setNotesText(notesXml: any, notes: string) {
  const shape = findShapeByName(notesXml, "Notes Placeholder 2");
  if (!shape) return;

  const txBody = shape["p:txBody"]?.[0];
  if (!txBody) return;

  const basePara = deepClone(txBody["a:p"]?.[0] ?? {});

  const lines = splitIntoParagraphs(notes);
  txBody["a:p"] = lines.map((line) => buildParagraph(basePara, line));
}

function populateSectionBreakSlide(
  slideXml: any,
  slideData: SectionBreakSlide,
) {
  setShapeText(slideXml, "Title 5", slideData.title);

  if (slideData.description) {
    setShapeText(slideXml, "TextBox 7", slideData.description);
  } else {
    clearShapeText(slideXml, "TextBox 7");
  }

  if (slideData.highlights && slideData.highlights.length > 0) {
    setShapeLines(slideXml, "TextBox 8", slideData.highlights);
  } else {
    clearShapeText(slideXml, "TextBox 8");
  }
}

function populateBulletSlide(
  slideXml: any,
  slideData: BulletSlide,
  options: { includeFooter: boolean },
) {
  if (slideData.eyebrow) {
    setShapeText(slideXml, "TextBox 27", slideData.eyebrow);
  } else {
    clearShapeText(slideXml, "TextBox 27");
  }

  setShapeText(slideXml, "TextBox 14", slideData.title);
  setShapeLines(slideXml, "TextBox 13", slideData.bullets);

  if (slideData.supportingPoints && slideData.supportingPoints.length > 0) {
    setShapeLines(slideXml, "TextBox 11", slideData.supportingPoints);
  } else {
    clearShapeText(slideXml, "TextBox 11");
  }

  if (slideData.kickerLeft) {
    setShapeText(slideXml, "TextBox 4", slideData.kickerLeft);
  } else if (!options.includeFooter) {
    clearShapeText(slideXml, "TextBox 4");
  }

  if (slideData.kickerRight) {
    setShapeText(slideXml, "TextBox 5", slideData.kickerRight);
  } else if (!options.includeFooter) {
    clearShapeText(slideXml, "TextBox 5");
  }
}

function populateTwoColumnSlide(
  slideXml: any,
  slideData: TwoColumnSlide,
  options: { includeFooter: boolean },
) {
  setShapeText(slideXml, "TextBox 14", slideData.title);
  setShapeLines(slideXml, "TextBox 13", slideData.leftColumn);

  const rightLines = slideData.rightColumn ?? [];

  if (slideData.rightTitle) {
    setShapeLines(slideXml, "TextBox 11", [
      slideData.rightTitle,
      "",
      ...rightLines,
    ]);
  } else {
    setShapeLines(slideXml, "TextBox 11", rightLines);
  }

  if (slideData.eyebrow) {
    setShapeText(slideXml, "TextBox 4", slideData.eyebrow);
  } else if (!options.includeFooter) {
    clearShapeText(slideXml, "TextBox 4");
  }

  if (!options.includeFooter) {
    clearShapeText(slideXml, "TextBox 5");
  }
}

function populateKpiGridSlide(
  slideXml: any,
  slideData: KpiGridSlide,
  options: { includeFooter: boolean },
) {
  setShapeText(slideXml, "TextBox 14", slideData.title);

  if (slideData.summary) {
    setShapeText(slideXml, "Rounded Rectangle 35", slideData.summary);
  } else {
    clearShapeText(slideXml, "Rounded Rectangle 35");
  }

  if (slideData.summary) {
    setShapeText(slideXml, "TextBox 13", slideData.summary);
  } else {
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

    const lines = [
      metric.value,
      metric.label,
      metric.delta ? `Δ ${metric.delta}` : undefined,
      metric.description,
    ]
      .filter(Boolean)
      .map((line) => line as string);

    setShapeLines(slideXml, shapeName, lines);
  });

  if (slideData.footnotes && slideData.footnotes.length > 0) {
    setShapeLines(slideXml, "TextBox 4", [slideData.footnotes[0]]);
    if (slideData.footnotes[1]) {
      setShapeLines(slideXml, "TextBox 5", [slideData.footnotes[1]]);
    } else if (!options.includeFooter) {
      clearShapeText(slideXml, "TextBox 5");
    }
  } else if (!options.includeFooter) {
    clearShapeText(slideXml, "TextBox 4");
    clearShapeText(slideXml, "TextBox 5");
  }
}

function populateQuoteSlide(
  slideXml: any,
  slideData: QuoteSlide,
  options: { includeFooter: boolean },
) {
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

function setShapeLines(slideXml: any, shapeName: string, lines: string[]) {
  const shape = findShapeByName(slideXml, shapeName);
  if (!shape) return;

  const txBody = shape["p:txBody"]?.[0];
  if (!txBody) return;

  const basePara = deepClone(txBody["a:p"]?.[0] ?? {});
  const normalizedLines = lines.length > 0 ? lines : [""];

  txBody["a:p"] = normalizedLines.map((line) =>
    buildParagraph(basePara, line),
  );
}

function setShapeText(slideXml: any, shapeName: string, text: string) {
  setShapeLines(slideXml, shapeName, [text]);
}

function clearShapeText(slideXml: any, shapeName: string) {
  const shape = findShapeByName(slideXml, shapeName);
  if (!shape) return;

  const txBody = shape["p:txBody"]?.[0];
  if (!txBody) return;

  const basePara = deepClone(txBody["a:p"]?.[0] ?? {});
  txBody["a:p"] = [buildParagraph(basePara, "")];
}

function buildParagraph(basePara: any, text: string) {
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

function findShapeByName(xml: any, name: string) {
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
