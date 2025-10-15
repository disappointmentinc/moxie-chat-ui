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
 * This preserves all template styling, master layouts, and theme including logo
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

    // Step 2: Parse presentation.xml
    const presentationXml = await zip.file("ppt/presentation.xml")?.async("string");
    if (!presentationXml) {
      throw new Error("presentation.xml not found in template");
    }

    const presentation = await parseStringPromise(presentationXml);

    // Step 3: Parse presentation relationships
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
    const titleSlideFile = "ppt/slides/slide1.xml";
    const contentTemplateFile = "ppt/slides/slide2.xml";

    // Step 5: Remove all slides except slide1 and slide2
    const slidesToRemove = slideRels
      .filter((rel) => {
        const slideNum = Number.parseInt(rel.$.Target.match(/slide(\d+)\.xml/)?.[1] || "0");
        return slideNum > 2;
      });

    for (const rel of slidesToRemove) {
      const slideFile = `ppt/${rel.$.Target}`;
      zip.remove(slideFile);

      const slideNum = rel.$.Target.match(/slide(\d+)\.xml/)?.[1];
      if (slideNum) {
        zip.remove(`ppt/slides/_rels/slide${slideNum}.xml.rels`);
      }
    }

    // Keep only relationships for slide1 and slide2
    const keepRels = relationships.filter((rel) => {
      if (!rel.$.Type.includes("slide") || rel.$.Type.includes("slideMaster") || rel.$.Type.includes("slideLayout")) {
        return true;
      }
      const slideNum = Number.parseInt(rel.$.Target.match(/slide(\d+)\.xml/)?.[1] || "0");
      return slideNum <= 2;
    });

    presRels.Relationships.Relationship = keepRels;

    // Step 6: Modify the title slide (leave logo intact - just update title)
    await modifyTitleSlide(zip, titleSlideFile, data.title, data.subtitle);

    // Step 7: Clone content slide for each data slide (starting at slide3)
    const startSlideNumber = 3;
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
          id: `${256 + slideNumber}`,
          "r:id": `rId${maxRid + 1 + i}`,
        },
      };
      slideIdList["p:sldId"].push(newSlideId);
    }

    // Step 9: Write updated XML back to zip
    const builder = new Builder();
    const updatedPresentationXml = builder.buildObject(presentation);
    zip.file("ppt/presentation.xml", updatedPresentationXml);

    const updatedPresRelsXml = builder.buildObject(presRels);
    zip.file("ppt/_rels/presentation.xml.rels", updatedPresRelsXml);

    // Step 10: Update [Content_Types].xml
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
 * Modify the title slide - only update text in TextBox placeholders, leave logo intact
 */
async function modifyTitleSlide(
  zip: JSZip,
  slideFile: string,
  title: string,
  subtitle?: string,
): Promise<void> {
  const slideXml = await zip.file(slideFile)?.async("string");
  if (!slideXml) {
    logger.warn(`Title slide ${slideFile} not found`);
    return;
  }

  const slide = await parseStringPromise(slideXml);
  const shapes = slide["p:sld"]["p:cSld"][0]["p:spTree"][0]["p:sp"] || [];

  // Find the title placeholder (usually has <p:ph type="title"/>)
  for (const shape of shapes) {
    const nvPr = shape["p:nvSpPr"]?.[0]?.["p:nvPr"]?.[0];
    const ph = nvPr?.["p:ph"]?.[0];

    if (ph && ph.$.type === "title" && shape["p:txBody"]) {
      // Update title text
      updateTextInTextBox(shape, title);
      break;
    }
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
  const shapes = slide["p:sld"]["p:cSld"][0]["p:spTree"][0]["p:sp"] || [];

  // Find TextBox 14 (title) and TextBox 13 (content)
  // Based on template analysis:
  // - TextBox 14 (id="15") is at y="472311" - TITLE
  // - TextBox 13 (id="14") is at y="1373010" - CONTENT

  for (const shape of shapes) {
    const cNvPr = shape["p:nvSpPr"]?.[0]?.["p:cNvPr"]?.[0];
    const name = cNvPr?.$.name || "";

    // Update title TextBox
    if (name === "TextBox 14" && shape["p:txBody"]) {
      updateTextInTextBox(shape, slideData.title);
    }

    // Update content TextBox
    if (name === "TextBox 13" && shape["p:txBody"]) {
      updateBulletListInTextBox(shape, slideData.content);
    }
  }

  // Save the modified slide
  const builder = new Builder();
  const newSlideXml = builder.buildObject(slide);
  const newSlideFile = `ppt/slides/slide${newSlideNumber}.xml`;
  zip.file(newSlideFile, newSlideXml);

  // Clone slide relationships
  await cloneSlideRelationships(
    zip,
    templateSlideFile.replace("slides/", "").replace(".xml", ""),
    `slide${newSlideNumber}`,
  );

  logger.info(`Cloned and modified slide ${newSlideNumber}`);
}

/**
 * Update text content in a TextBox shape
 */
function updateTextInTextBox(shape: any, text: string): void {
  const txBody = shape["p:txBody"][0];

  // Get existing font formatting from template
  const existingPara = txBody["a:p"]?.[0];
  const existingRPr = existingPara?.["a:endParaRPr"]?.[0] || existingPara?.["a:pPr"]?.[0]?.["a:defRPr"]?.[0];

  // Create new paragraph with text, preserving template formatting
  txBody["a:p"] = [
    {
      "a:r": [
        {
          "a:rPr": existingRPr ? [existingRPr] : [],
          "a:t": [text],
        },
      ],
    },
  ];
}

/**
 * Update bullet list content in a TextBox shape
 */
function updateBulletListInTextBox(shape: any, bullets: string[]): void {
  const txBody = shape["p:txBody"][0];

  // Get existing formatting from template
  const existingPara = txBody["a:p"]?.[0];
  const existingRPr = existingPara?.["a:endParaRPr"]?.[0];
  const existingPPr = existingPara?.["a:pPr"]?.[0];

  // Create paragraph for each bullet point, preserving formatting
  txBody["a:p"] = bullets.map((bullet, index) => {
    const para: any = {
      "a:r": [
        {
          ...(existingRPr && { "a:rPr": [existingRPr] }),
          "a:t": [bullet],
        },
      ],
    };

    // Add bullet formatting to paragraphs after the first
    if (index < bullets.length && existingPPr) {
      para["a:pPr"] = [existingPPr];
    }

    return para;
  });
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
    const newRelsFile = `ppt/slides/_rels/${newSlideName}.xml.rels`;
    zip.file(newRelsFile, templateRelsXml);
  }
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

  // Remove Override entries for slides > 2
  if (contentTypes.Types.Override) {
    contentTypes.Types.Override = contentTypes.Types.Override.filter((o: any) => {
      const match = o.$.PartName.match(/\/ppt\/slides\/slide(\d+)\.xml/);
      if (!match) return true;
      const slideNum = Number.parseInt(match[1]);
      return slideNum <= 2;
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
