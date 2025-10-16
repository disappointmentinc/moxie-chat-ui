/**
 * Quick smoke test that invokes the template-based PPTX generator and writes the file to .yak.
 * This is intended for CLI validation without spinning up the full Next.js runtime.
 */
import Module from "module";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import type { PresentationData } from "../src/lib/pptx/pptx-builder";

// Shim the "server-only" module so we can import the generator in a CLI environment.
const originalLoad = Module._load;
Module._load = function patched(request, parent, isMain) {
  if (request === "server-only" || request.includes("server-only")) {
    return {};
  }
  return originalLoad.apply(this, arguments as unknown as [string, NodeModule, boolean]);
};

async function main() {
  const { generatePPTX } = await import("../src/lib/pptx/pptx-builder");
  const data: PresentationData = {
    title: "Template Logo Smoke Test",
    subtitle: "Ensure title slide keeps layout",
    slides: [
      {
        layout: "bullets",
        title: "Agenda",
        bullets: ["Intro", "Demo", "Q&A"],
      },
      {
        layout: "section-break",
        title: "Highlights",
        description: "Key outcomes",
      },
    ],
  };

  const buffer = await generatePPTX(data, {
    theme: "healthrise",
    includeFooter: true,
    useTemplate: true,
  });

  const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".yak", "template-smoke-output.pptx");
  await fs.writeFile(out, buffer);
  console.log(`PPTX written to ${out}`);
}

main().catch(error => {
  console.error("Failed to run template smoke test:", error);
  process.exit(1);
});
