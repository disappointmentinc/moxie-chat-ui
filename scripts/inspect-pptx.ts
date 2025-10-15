import fs from "fs/promises";
import path from "path";
import JSZip from "jszip";
import { parseStringPromise } from "xml2js";

interface ShapeSummary {
  name: string;
  text: string;
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: pnpm pptx:inspect <path-to-pptx>");
    process.exit(1);
  }

  const absolutePath = path.resolve(filePath);
  const fileBuffer = await fs.readFile(absolutePath);
  const zip = await JSZip.loadAsync(fileBuffer);

  const slideEntries = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const slideA = Number.parseInt(a.match(/slide(\d+)\.xml$/)?.[1] ?? "0", 10);
      const slideB = Number.parseInt(b.match(/slide(\d+)\.xml$/)?.[1] ?? "0", 10);
      return slideA - slideB;
    });

  console.log(`Slides found: ${slideEntries.length}`);
  console.log();

  for (const slidePath of slideEntries) {
    const slideNumber = Number.parseInt(
      slidePath.match(/slide(\d+)\.xml$/)?.[1] ?? "0",
      10,
    );
    const slideXml = await zip.file(slidePath)!.async("string");
    const slide = await parseStringPromise(slideXml);

    const summary = extractSlideSummary(slide);
    console.log(`Slide ${slideNumber}`);
    summary.forEach((shape) => {
      if (!shape.text) return;
      console.log(`  ${shape.name}: ${shape.text}`);
    });

    const notesPath = `ppt/notesSlides/notesSlide${slideNumber}.xml`;
    if (zip.file(notesPath)) {
      const notesXml = await zip.file(notesPath)!.async("string");
      const notes = await parseStringPromise(notesXml);
      const noteText = extractNotesText(notes);
      if (noteText) {
        console.log(`  Notes: ${noteText}`);
      }
    }

    console.log();
  }
}

function extractSlideSummary(slide: any): ShapeSummary[] {
  const spTree =
    slide?.["p:sld"]?.["p:cSld"]?.[0]?.["p:spTree"]?.[0]?.["p:sp"] ?? [];

  return spTree.map((shape: any) => {
    const name =
      shape?.["p:nvSpPr"]?.[0]?.["p:cNvPr"]?.[0]?.$.name ?? "Unnamed Shape";
    const textRuns =
      shape?.["p:txBody"]?.[0]?.["a:p"]?.flatMap((para: any) =>
        para?.["a:r"]?.map((run: any) => run?.["a:t"]?.[0] ?? ""),
      ) ?? [];
    const text = textRuns.join(" ").trim();
    return { name, text };
  });
}

function extractNotesText(notes: any): string {
  const spTree =
    notes?.["p:notes"]?.["p:cSld"]?.[0]?.["p:spTree"]?.[0]?.["p:sp"] ?? [];
  const notesShape = spTree.find(
    (shape: any) =>
      shape?.["p:nvSpPr"]?.[0]?.["p:cNvPr"]?.[0]?.$.name === "Notes Placeholder 2",
  );

  if (!notesShape) return "";

  const textRuns =
    notesShape?.["p:txBody"]?.[0]?.["a:p"]?.flatMap((para: any) =>
      para?.["a:r"]?.map((run: any) => run?.["a:t"]?.[0] ?? ""),
    ) ?? [];

  return textRuns.join(" ").trim();
}

main().catch((error) => {
  console.error("Failed to inspect PPTX:", error);
  process.exit(1);
});
