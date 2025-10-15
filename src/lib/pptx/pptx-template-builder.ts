import "server-only";

import JSZip from "jszip";
import { parseStringPromise, Builder } from "xml2js";
import fs from "fs/promises";
import path from "path";
import logger from "logger";
import type { PresentationData } from "./pptx-builder";

const TEMPLATE_PATH = path.join(process.cwd(), ".yak", "template__Comp.pptx");

interface SlideRelationship {
  $: {
    Id: string;
    Type: string;
    Target: string;
  };
}

/**
 * Generate a PPTX file using the template__Comp.pptx as a base
 * This preserves all template styling, master layouts, and theme
 */
export async function generatePPTXFromTemplate(
  data: PresentationData,
): Promise<Buffer> {
  logger.info(
    `Generating PPTX from template: ${data.title} with ${data.slides.length} slides`,
  );

  try {
    // Step 1: Load the template PPTX file
    const templateBuffer = await fs.readFile(TEMPLATE_PATH);
    const zip = await JSZip.loadAsync(templateBuffer);

    // Step 2: Parse presentation.xml to understand structure
    const presentationXml = await zip.file("ppt/presentation.xml")?.async("string");
    if (!presentationXml) {
      throw new Error("presentation.xml not found in template");
    }

    const presentation = await parseStringPromise(presentationXml);

    // Step 3: Parse presentation relationships to find existing slides
    const presRelsXml = await zip
      .file("ppt/_rels/presentation.xml.rels")
      ?.async("string");
    if (!presRelsXml) {
      throw new Error("presentation.xml.rels not found in template");
    }

    const presRels = await parseStringPromise(presRelsXml);
    const relationships: SlideRelationship[] =
      presRels.Relationships.Relationship;

    // Find existing slide relationships
    const slideRels = relationships.filter((rel) =>
      rel.$.Type.includes("slide") &&
      !rel.$.Type.includes("slideMaster") &&
      !rel.$.Type.includes("slideLayout")
    );

    logger.info(`Template has ${slideRels.length} existing slides - will clean and rebuild`);

    // Step 4: Determine which slides to use
    // slide1 = title slide, slide2 = content template
    const titleSlideFile = "ppt/slides/slide1.xml";
    const contentTemplateFile = "ppt/slides/slide2.xml";

    // Step 5: Remove all slides except slide1 and slide2 from the template
    const slidesToRemove = slideRels
      .filter((rel) => {
        const slideNum = Number.parseInt(rel.$.Target.match(/slide(\d+)\.xml/)?.[1] || "0");
        return slideNum > 2;
      });

    for (const rel of slidesToRemove) {
      const slideFile = `ppt/${rel.$.Target}`;
      zip.remove(slideFile);

      // Remove relationship file
      const slideNum = rel.$.Target.match(/slide(\d+)\.xml/)?.[1];
      if (slideNum) {
        zip.remove(`ppt/slides/_rels/slide${slideNum}.xml.rels`);
      }

      logger.info(`Removed ${slideFile} from template`);
    }

    // Remove the slide relationships for deleted slides
    const keepRels = relationships.filter((rel) => {
      if (!rel.$.Type.includes("slide") || rel.$.Type.includes("slideMaster") || rel.$.Type.includes("slideLayout")) {
        return true;
      }
      const slideNum = Number.parseInt(rel.$.Target.match(/slide(\d+)\.xml/)?.[1] || "0");
      return slideNum <= 2;
    });

    // Clear and rebuild relationships
    presRels.Relationships.Relationship = keepRels;

    // Step 6: Modify the title slide
    await modifyTitleSlide(zip, titleSlideFile, data.title, data.subtitle);

    // Step 7: Clone content slide for each data slide (starting at slide3)
    const startSlideNumber = 3;
    // Find the highest relationship ID to ensure unique IDs
    const maxRid = keepRels.reduce((max, rel) => {
      const ridNum = Number.parseInt(rel.$.Id.replace("rId", "")) || 0;
      return Math.max(max, ridNum);
    }, 0);

    for (let i = 0; i < data.slides.length; i++) {
      const slideNumber = startSlideNumber + i;
      const slideData = data.slides[i];

      await cloneAndModifyContentSlide(
        zip,
        contentTemplateFile,
        slideNumber,
        slideData,
      );

      // Add relationship for new slide
      const newRel: SlideRelationship = {
        $: {
          Id: `rId${maxRid + 1 + i}`,
          Type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide",
          Target: `slides/slide${slideNumber}.xml`,
        },
      };
      presRels.Relationships.Relationship.push(newRel);
    }

    // Step 8: Update presentation.xml with new slides
    const slideIdList = presentation["p:presentation"]["p:sldIdLst"][0];

    // Clear existing slide IDs except slide1 and slide2
    if (slideIdList["p:sldId"]) {
      slideIdList["p:sldId"] = slideIdList["p:sldId"].filter((sld: any) => {
        const rid = sld.$["r:id"];
        const matchingRel = keepRels.find(rel => rel.$.Id === rid);
        if (!matchingRel) return false;
        const slideNum = Number.parseInt(matchingRel.$.Target.match(/slide(\d+)\.xml/)?.[1] || "0");
        return slideNum <= 2;
      });
    } else {
      slideIdList["p:sldId"] = [];
    }

    // Add new slide IDs
    for (let i = 0; i < data.slides.length; i++) {
      const slideNumber = startSlideNumber + i;
      const newSlideId = {
        $: {
          id: `${256 + slideNumber}`, // PowerPoint slide IDs start at 256
          "r:id": `rId${maxRid + 1 + i}`,
        },
      };
      slideIdList["p:sldId"].push(newSlideId);
    }

    // Step 8: Write updated presentation.xml back to zip
    const builder = new Builder();
    const updatedPresentationXml = builder.buildObject(presentation);
    zip.file("ppt/presentation.xml", updatedPresentationXml);

    // Step 9: Write updated relationships back to zip
    const updatedPresRelsXml = builder.buildObject(presRels);
    zip.file("ppt/_rels/presentation.xml.rels", updatedPresRelsXml);

    // Step 10: Update [Content_Types].xml to include new slides
    await updateContentTypes(zip, startSlideNumber, data.slides.length);

    // Step 11: Generate final PPTX buffer
    const pptxBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 9 },
    });

    logger.info(
      `Successfully generated PPTX from template: ${pptxBuffer.length} bytes`,
    );

    return pptxBuffer;
  } catch (error) {
    logger.error("Error generating PPTX from template:", error);
    throw new Error(
      `Failed to generate PPTX from template: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Modify the title slide with new title and subtitle
 */
async function modifyTitleSlide(
  zip: JSZip,
  slideFile: string,
  title: string,
  subtitle?: string,
): Promise<void> {
  const slideXml = await zip.file(slideFile)?.async("string");
  if (!slideXml) {
    logger.warn(`Title slide ${slideFile} not found, skipping title modification`);
    return;
  }

  const slide = await parseStringPromise(slideXml);

  // Find text placeholders in the slide
  // PowerPoint slides have text in p:sp > p:txBody > a:p > a:r > a:t
  const shapes = slide["p:sld"]["p:cSld"][0]["p:spTree"][0]["p:sp"] || [];

  // Update title (usually first text shape)
  if (shapes.length > 0 && shapes[0]["p:txBody"]) {
    updateTextInShape(shapes[0], title);
  }

  // Update subtitle if provided (usually second text shape)
  if (subtitle && shapes.length > 1 && shapes[1]["p:txBody"]) {
    updateTextInShape(shapes[1], subtitle);
  }

  const builder = new Builder();
  const updatedSlideXml = builder.buildObject(slide);
  zip.file(slideFile, updatedSlideXml);

  logger.info("Modified title slide successfully");
}

/**
 * Clone a content slide and modify it with new content
 */
async function cloneAndModifyContentSlide(
  zip: JSZip,
  templateSlideFile: string,
  newSlideNumber: number,
  slideData: { title: string; content: string[]; notes?: string },
): Promise<void> {
  const templateXml = await zip.file(templateSlideFile)?.async("string");
  if (!templateXml) {
    throw new Error(`Template slide ${templateSlideFile} not found`);
  }

  const slide = await parseStringPromise(templateXml);

  // Find text placeholders
  const shapes = slide["p:sld"]["p:cSld"][0]["p:spTree"][0]["p:sp"] || [];

  // Update title (first text shape)
  if (shapes.length > 0 && shapes[0]["p:txBody"]) {
    updateTextInShape(shapes[0], slideData.title);
  }

  // Update content (second text shape - usually a text box with bullets)
  if (shapes.length > 1 && shapes[1]["p:txBody"]) {
    updateBulletListInShape(shapes[1], slideData.content);
  }

  // Save the modified slide as new file
  const builder = new Builder();
  const newSlideXml = builder.buildObject(slide);
  const newSlideFile = `ppt/slides/slide${newSlideNumber}.xml`;
  zip.file(newSlideFile, newSlideXml);

  // Clone and update slide relationships
  await cloneSlideRelationships(
    zip,
    templateSlideFile.replace("slides/", "").replace(".xml", ""),
    `slide${newSlideNumber}`,
  );

  // Add speaker notes if provided
  if (slideData.notes) {
    await addSpeakerNotes(zip, newSlideNumber, slideData.notes);
  }

  logger.info(`Cloned and modified slide ${newSlideNumber}`);
}

/**
 * Update text content in a PowerPoint shape
 */
function updateTextInShape(shape: any, text: string): void {
  const txBody = shape["p:txBody"][0];
  if (!txBody["a:p"]) {
    txBody["a:p"] = [{}];
  }

  // Create new text run
  txBody["a:p"] = [
    {
      "a:r": [
        {
          "a:t": [text],
        },
      ],
    },
  ];
}

/**
 * Update bullet list content in a PowerPoint shape
 */
function updateBulletListInShape(shape: any, bullets: string[]): void {
  const txBody = shape["p:txBody"][0];

  // Create paragraph for each bullet point
  txBody["a:p"] = bullets.map((bullet) => ({
    "a:r": [
      {
        "a:t": [bullet],
      },
    ],
  }));
}

/**
 * Clone slide relationships for a new slide
 */
async function cloneSlideRelationships(
  zip: JSZip,
  templateSlideName: string,
  newSlideName: string,
): Promise<void> {
  const templateRelsFile = `ppt/slides/_rels/${templateSlideName}.xml.rels`;
  const templateRelsXml = await zip.file(templateRelsFile)?.async("string");

  if (templateRelsXml) {
    // Clone the relationships file for the new slide
    const newRelsFile = `ppt/slides/_rels/${newSlideName}.xml.rels`;
    zip.file(newRelsFile, templateRelsXml);
  }
}

/**
 * Add speaker notes to a slide
 */
async function addSpeakerNotes(
  zip: JSZip,
  slideNumber: number,
  notes: string,
): Promise<void> {
  // PowerPoint notes are stored in ppt/notesSlides/notesSlide{N}.xml
  // This is a simplified implementation - full implementation would require
  // cloning notes master and creating proper relationships

  // For now, we'll skip notes implementation to keep it simple
  // TODO: Implement full notes support in future iteration
  logger.info(`Notes support not yet implemented for slide ${slideNumber}`);
}

/**
 * Update [Content_Types].xml to include new slides and remove old ones
 */
async function updateContentTypes(
  zip: JSZip,
  startSlideNumber: number,
  slideCount: number,
): Promise<void> {
  const contentTypesXml = await zip.file("[Content_Types].xml")?.async("string");
  if (!contentTypesXml) {
    throw new Error("[Content_Types].xml not found");
  }

  const contentTypes = await parseStringPromise(contentTypesXml);

  // Remove Override entries for slides > 2 (keep only slide1 and slide2 entries)
  if (contentTypes.Types.Override) {
    contentTypes.Types.Override = contentTypes.Types.Override.filter((o: any) => {
      const match = o.$.PartName.match(/\/ppt\/slides\/slide(\d+)\.xml/);
      if (!match) return true; // Keep non-slide entries
      const slideNum = Number.parseInt(match[1]);
      return slideNum <= 2; // Keep only slide1 and slide2
    });
  } else {
    contentTypes.Types.Override = [];
  }

  // Add Override entries for new slides
  for (let i = 0; i < slideCount; i++) {
    const slideNumber = startSlideNumber + i;
    const override = {
      $: {
        PartName: `/ppt/slides/slide${slideNumber}.xml`,
        ContentType:
          "application/vnd.openxmlformats-officedocument.presentationml.slide+xml",
      },
    };

    contentTypes.Types.Override.push(override);
  }

  const builder = new Builder();
  const updatedContentTypesXml = builder.buildObject(contentTypes);
  zip.file("[Content_Types].xml", updatedContentTypesXml);
}
