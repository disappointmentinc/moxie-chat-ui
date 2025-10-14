import { NextResponse } from "next/server";
import { getSession } from "auth/server";
import { searchDocuments } from "lib/rag/vectorize-store";
import { generatePPTX, validatePresentationData } from "lib/pptx/pptx-builder";
import { serverFileStorage } from "lib/file-storage";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import logger from "logger";
import type { PresentationData } from "lib/pptx/pptx-builder";

interface GeneratePPTXRequest {
  prompt: string;
  useRAG?: boolean;
  theme?: "light" | "dark" | "healthrise";
  maxSlides?: number;
}

/**
 * Generate PPTX presentation using AI and RAG
 *
 * POST /api/generate-pptx
 * Body: { prompt: string, useRAG?: boolean, theme?: string, maxSlides?: number }
 * Returns: { url: string, key: string, filename: string }
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: GeneratePPTXRequest = await request.json();
    const { prompt, useRAG = true, theme = "healthrise", maxSlides = 10 } = body;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: "Prompt is required and must be a non-empty string" },
        { status: 400 },
      );
    }

    logger.info(
      `Generating PPTX for user ${session.user.id}: "${prompt}" (RAG: ${useRAG})`,
    );

    // Step 1: Search RAG for relevant content (if enabled)
    let contextContent = "";
    if (useRAG) {
      try {
        logger.info(`Searching RAG for: "${prompt}"`);
        const ragResults = await searchDocuments(prompt, 10);

        if (ragResults.length > 0) {
          contextContent = ragResults
            .map(
              (result, i) =>
                `[Source ${i + 1}] (Score: ${result.score.toFixed(2)}, File: ${result.metadata.filename})\n${result.text}`,
            )
            .join("\n\n");

          logger.info(
            `Found ${ragResults.length} relevant documents from RAG`,
          );
        } else {
          logger.info("No relevant documents found in RAG");
        }
      } catch (error) {
        logger.warn("RAG search failed, continuing without context:", error);
      }
    }

    // Step 2: Generate presentation structure using AI
    const systemPrompt = `You are a professional presentation designer. Your task is to create a well-structured presentation outline in JSON format.

The presentation should:
- Have a clear title and optional subtitle
- Include ${maxSlides} content slides (excluding title slide)
- Each slide should have a title and 3-5 bullet points
- Content should be clear, concise, and actionable
- Use professional language appropriate for business presentations

${contextContent ? "Use the provided context from uploaded documents to inform your content. Cite sources where appropriate." : "Generate content based on the user's prompt."}

Return ONLY valid JSON in this exact format:
{
  "title": "Presentation Title",
  "subtitle": "Optional Subtitle",
  "slides": [
    {
      "title": "Slide Title",
      "content": ["Bullet point 1", "Bullet point 2", "Bullet point 3"],
      "notes": "Optional speaker notes"
    }
  ]
}`;

    const userPrompt = contextContent
      ? `Create a presentation about: "${prompt}"\n\nRelevant context from uploaded documents:\n\n${contextContent}`
      : `Create a presentation about: "${prompt}"`;

    logger.info("Calling AI to generate presentation structure");

    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.7,
    });

    // Step 3: Parse AI response and validate
    logger.info("Parsing AI response");
    let presentationData: PresentationData;

    try {
      // Try to extract JSON from response (in case AI adds explanation text)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in AI response");
      }

      presentationData = JSON.parse(jsonMatch[0]);

      if (!validatePresentationData(presentationData)) {
        throw new Error("Invalid presentation data structure");
      }

      // Limit slides to maxSlides
      if (presentationData.slides.length > maxSlides) {
        presentationData.slides = presentationData.slides.slice(0, maxSlides);
      }

      // Add author
      presentationData.author = session.user.name || session.user.email;
    } catch (parseError) {
      logger.error("Failed to parse AI response:", parseError);
      logger.error("AI response was:", text);
      return NextResponse.json(
        {
          error: "Failed to generate presentation structure",
          details:
            parseError instanceof Error ? parseError.message : "Parse error",
        },
        { status: 500 },
      );
    }

    // Step 4: Generate PPTX file
    logger.info("Generating PPTX file");
    const pptxBuffer = await generatePPTX(presentationData, { theme });

    // Step 5: Upload to R2
    const filename = `${presentationData.title.replace(/[^a-z0-9]/gi, "_")}_${Date.now()}.pptx`;
    logger.info(`Uploading PPTX to storage: ${filename}`);

    const uploadResult = await serverFileStorage.upload(pptxBuffer, {
      filename,
      contentType:
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    });

    logger.info(
      `Successfully generated and uploaded PPTX: ${uploadResult.key}`,
    );

    // Step 6: Return download URL
    return NextResponse.json({
      success: true,
      url: uploadResult.sourceUrl,
      key: uploadResult.key,
      filename,
      metadata: {
        title: presentationData.title,
        slideCount: presentationData.slides.length + 1, // +1 for title slide
        theme,
        size: pptxBuffer.length,
      },
    });
  } catch (error) {
    logger.error("PPTX generation error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate presentation",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
