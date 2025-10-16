import { NextResponse } from "next/server";
import { getSession } from "auth/server";
import { generatePPTX, validatePresentationData } from "lib/pptx/pptx-builder";
import { verifyPPTXIntegrity } from "lib/pptx/pptx-integrity";
import logger from "logger";
import type { PresentationData } from "lib/pptx/pptx-builder";

interface ExportRequest {
  presentation: PresentationData;
  theme?: "light" | "dark" | "healthrise";
}

/**
 * Export presentation from slide editor to PPTX file
 *
 * POST /api/slide-editor/export
 * Body: { presentation: PresentationData, theme?: string }
 * Returns: Binary PPTX file
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: ExportRequest = await request.json();
    const { presentation, theme = "healthrise" } = body;

    if (!presentation || typeof presentation !== "object") {
      return NextResponse.json(
        { error: "Presentation data is required" },
        { status: 400 }
      );
    }

    // Validate presentation structure
    if (!validatePresentationData(presentation)) {
      return NextResponse.json(
        { error: "Invalid presentation data structure" },
        { status: 400 }
      );
    }

    logger.info(
      `Exporting presentation "${presentation.title}" with ${presentation.slides.length} slides (user: ${session.user.id})`
    );

    // Generate PPTX file
    const pptxBuffer = await generatePPTX(presentation, { theme });

    // Verify integrity
    await verifyPPTXIntegrity(pptxBuffer, presentation.slides.length + 1);

    // Generate filename
    const filename = `${presentation.title.replace(/[^a-z0-9]/gi, "_")}_${Date.now()}.pptx`;

    logger.info(`Successfully exported PPTX: ${filename}`);

    // Return PPTX file as binary response
    // Convert Buffer to ReadableStream for NextResponse
    return new NextResponse(pptxBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pptxBuffer.length.toString(),
      },
    });
  } catch (error) {
    logger.error("PPTX export error:", error);
    return NextResponse.json(
      {
        error: "Failed to export presentation",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
