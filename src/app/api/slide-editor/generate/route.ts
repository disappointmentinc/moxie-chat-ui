import { NextResponse } from "next/server";
import { getSession } from "auth/server";
import { searchDocuments } from "lib/rag/vectorize-store";
import { validatePresentationData } from "lib/pptx/pptx-builder";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import logger from "logger";
import type { PresentationData, SlideLayoutType } from "lib/pptx/pptx-builder";
import { chatRepository } from "lib/db/repository";

const ALL_SLIDE_LAYOUTS: SlideLayoutType[] = [
  "section-break",
  "bullets",
  "two-column",
  "kpi-grid",
  "quote",
  "comparison",
  "timeline",
];

const LAYOUT_LABELS: Record<SlideLayoutType, string> = {
  "section-break": "section-break (framing slide)",
  "bullets": "bullets (core narrative)",
  "two-column": "two-column (compare/contrast)",
  "kpi-grid": "kpi-grid (metrics spotlight)",
  "quote": "quote (testimonial)",
  "comparison": "comparison (side-by-side findings)",
  "timeline": "timeline (milestones roadmap)",
};

/**
 * Generate slide structure from chat thread for the slide editor
 *
 * POST /api/slide-editor/generate
 * Body: { threadId: string }
 * Returns: { presentation: PresentationData }
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { threadId } = body;

    if (!threadId || typeof threadId !== "string") {
      return NextResponse.json(
        { error: "Thread ID is required" },
        { status: 400 }
      );
    }

    logger.info(`Generating slides for thread ${threadId} (user ${session.user.id})`);

    // Fetch chat messages from thread
    const messages = await chatRepository.selectMessagesByThreadId(threadId);

    if (messages.length === 0) {
      return NextResponse.json(
        { error: "No messages found in thread" },
        { status: 404 }
      );
    }

    // Convert messages to simple format for AI
    const simpleMessages = messages.map((m) => ({
      role: m.role,
      content: m.parts
        .filter((p) => p.type === "text")
        .map((p: any) => p.text)
        .join("\n"),
    }));

    // Extract topic from recent messages
    const recentMessages = simpleMessages.slice(-10);
    const prompt = recentMessages
      .filter((m) => m.role === "user")
      .map((m) => m.content)
      .join(" ")
      .substring(0, 500);

    // Step 1: Search RAG for relevant content
    let contextContent = "";
    let ragResultsCount = 0;
    const ragSources: Set<string> = new Set();

    try {
      logger.info(`Searching RAG for: "${prompt.substring(0, 100)}..."`);

      const queryVariants = [
        prompt,
        `Key information about: ${prompt}`,
        `Data and statistics related to: ${prompt}`,
      ];

      const allResults = await Promise.all(
        queryVariants.map((query) => searchDocuments(query, 5))
      );

      const seenChunks = new Set<string>();
      const uniqueResults = allResults
        .flat()
        .filter((result) => {
          const chunkId = `${result.metadata.filename}-${result.text.substring(0, 50)}`;
          if (seenChunks.has(chunkId)) return false;
          seenChunks.add(chunkId);
          return true;
        })
        .filter((result) => result.score >= 0.65)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

      if (uniqueResults.length > 0) {
        const resultsBySource = uniqueResults.reduce(
          (acc, result) => {
            const filename = result.metadata.filename || "Unknown";
            if (!acc[filename]) acc[filename] = [];
            acc[filename].push(result);
            ragSources.add(filename);
            return acc;
          },
          {} as Record<string, typeof uniqueResults>
        );

        contextContent = Object.entries(resultsBySource)
          .map(([filename, results]) => {
            const chunks = results
              .map(
                (r, i) =>
                  `  [Chunk ${i + 1}] (Relevance: ${(r.score * 100).toFixed(0)}%)\n  ${r.text}`
              )
              .join("\n\n");
            return `## Source: ${filename}\n\n${chunks}`;
          })
          .join("\n\n---\n\n");

        ragResultsCount = uniqueResults.length;
      }
    } catch (error) {
      logger.warn("RAG search failed, continuing without context:", error);
    }

    // Step 2: Generate presentation structure using AI
    const allowedLayoutLines = ALL_SLIDE_LAYOUTS
      .map((layout) => `- "${layout}": ${LAYOUT_LABELS[layout]}`)
      .join("\n");

    const systemPrompt = `You are a presentation designer creating an executive deck. Return valid JSON only.

OBJECTIVES:
- Create 8-12 high-impact slides (excluding title)
- Vary layouts for visual interest
- Include speaker notes with source citations
- Reference the conversation context throughout

LAYOUT OPTIONS:
${allowedLayoutLines}

LAYOUT SPECIFICATIONS:
- "section-break": { layout, title, eyebrow?, description?, highlights[]?, notes? }
- "bullets": { layout, title, eyebrow?, bullets[], supportingPoints[]?, kickerLeft?, kickerRight?, notes? }
- "two-column": { layout, title, eyebrow?, leftColumn[], rightColumn[], rightTitle?, notes? }
- "kpi-grid": { layout, title, summary?, metrics[{label, value, delta?, description?}], footnotes[]?, notes? }
- "quote": { layout, title, eyebrow?, quote, attribution?, supportingPoints[]?, notes? }
- "comparison": { layout, title, eyebrow?, summary?, tableTitle?, columns[{title, bullets[]}], footnotes[]?, notes? }
- "timeline": { layout, title, summary?, milestones[{date?, title, description?}], footnotes[]?, notes? }

RETURN FORMAT (valid JSON only):
{
  "title": "Presentation Title",
  "subtitle": "Optional subtitle or null",
  "slides": [
    {
      "layout": "bullets",
      "title": "Slide Title",
      "bullets": ["Point 1", "Point 2", "Point 3"],
      "notes": "Speaker notes with citations"
    }
  ]
}`;

    // Build user prompt with chat context
    const conversationSummary = simpleMessages
      .slice(-20)
      .map((msg, index) => `[${index + 1}] ${msg.role}: ${msg.content}`)
      .join("\n");

    let userPrompt = `## CONVERSATION CONTEXT\n\n${conversationSummary}\n\n`;

    if (contextContent) {
      userPrompt += `\n## KNOWLEDGE BASE CONTEXT\n\n${contextContent}\n\n`;
    }

    userPrompt += `Based on this conversation, create a comprehensive presentation that summarizes the key points, insights, and action items discussed.`;

    logger.info("Calling AI to generate presentation structure");

    let text: string;
    try {
      const result = await generateText({
        model: openai("gpt-5"),
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.7,
      });
      text = result.text;
    } catch (aiError) {
      logger.error("AI generation failed:", aiError);
      return NextResponse.json(
        {
          error: "Failed to generate slides",
          details: aiError instanceof Error ? aiError.message : "Unknown AI error",
        },
        { status: 500 }
      );
    }

    // Step 3: Parse and validate response
    let presentationData: PresentationData;

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in AI response");
      }

      presentationData = JSON.parse(jsonMatch[0]);

      if (!validatePresentationData(presentationData)) {
        throw new Error("Invalid presentation data structure");
      }

      // Limit slides to 20
      if (presentationData.slides.length > 20) {
        presentationData.slides = presentationData.slides.slice(0, 20);
      }

      // Add author
      presentationData.author = session.user.name || session.user.email;

      logger.info(
        `Generated ${presentationData.slides.length} slides for thread ${threadId}`
      );
    } catch (parseError) {
      logger.error("Failed to parse AI response:", parseError);
      logger.error("AI response was:", text);
      return NextResponse.json(
        {
          error: "Failed to generate presentation structure",
          details: parseError instanceof Error ? parseError.message : "Parse error",
        },
        { status: 500 }
      );
    }

    // Return presentation data
    return NextResponse.json({
      success: true,
      presentation: presentationData,
      metadata: {
        slideCount: presentationData.slides.length + 1,
        ragChunksUsed: ragResultsCount,
        ragSourcesUsed: ragSources.size,
        ragSources: Array.from(ragSources),
      },
    });
  } catch (error) {
    logger.error("Slide generation error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate slides",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
