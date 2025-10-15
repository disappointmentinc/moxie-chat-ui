import { NextResponse } from "next/server";
import { getSession } from "auth/server";
import { searchDocuments } from "lib/rag/vectorize-store";
import { generatePPTX, validatePresentationData } from "lib/pptx/pptx-builder";
import { serverFileStorage } from "lib/file-storage";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import logger from "logger";
import type { PresentationData, SlideLayoutType } from "lib/pptx/pptx-builder";
import { verifyPPTXIntegrity } from "lib/pptx/pptx-integrity";

interface GeneratePPTXRequest {
  prompt: string;
  useRAG?: boolean;
  theme?: "light" | "dark" | "healthrise";
  maxSlides?: number;
  chatContext?: Array<{ role: string; content: string }>; // Recent conversation history
  preferredLayouts?: SlideLayoutType[];
}

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
    const {
      prompt,
      useRAG = true,
      theme = "healthrise",
      maxSlides = 20,
      chatContext = [],
      preferredLayouts: preferredLayoutsRaw,
    } = body;

    let preferredLayouts: SlideLayoutType[] = Array.isArray(preferredLayoutsRaw)
      ? preferredLayoutsRaw.filter((layout): layout is SlideLayoutType =>
          ALL_SLIDE_LAYOUTS.includes(layout as SlideLayoutType),
        )
      : ALL_SLIDE_LAYOUTS;

    if (preferredLayouts.length === 0) {
      preferredLayouts = ALL_SLIDE_LAYOUTS;
    }
    logger.info(
      `PPTX layout preferences: ${preferredLayouts.join(", ")}.`,
    );

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: "Prompt is required and must be a non-empty string" },
        { status: 400 },
      );
    }

    logger.info(
      `Generating PPTX for user ${session.user.id}: "${prompt}" (RAG: ${useRAG})`,
    );

    // Step 1: Search RAG for relevant content with multi-query expansion
    let contextContent = "";
    let ragResultsCount = 0;
    const ragSources: Set<string> = new Set();

    if (useRAG) {
      try {
        logger.info(
          `Searching RAG with multi-query expansion for: "${prompt}"`,
        );

        // Multi-query expansion: Generate alternative search queries
        const queryVariants = [
          prompt, // Original query
          `Key information about: ${prompt}`, // Information-seeking variant
          `Data and statistics related to: ${prompt}`, // Data-focused variant
          `Background and context for: ${prompt}`, // Context variant
        ];

        // Search with all query variants and collect results
        const allResults = await Promise.all(
          queryVariants.map((query) => searchDocuments(query, 5)),
        );

        // Flatten and deduplicate results by chunk ID
        const seenChunks = new Set<string>();
        const uniqueResults = allResults
          .flat()
          .filter((result) => {
            const chunkId = `${result.metadata.filename}-${result.text.substring(0, 50)}`;
            if (seenChunks.has(chunkId)) return false;
            seenChunks.add(chunkId);
            return true;
          })
          // Apply relevance threshold (only high-confidence results)
          .filter((result) => result.score >= 0.65)
          // Sort by relevance score
          .sort((a, b) => b.score - a.score)
          // Take top 15 most relevant
          .slice(0, 15);

        if (uniqueResults.length > 0) {
          // Group results by source file for better organization
          const resultsBySource = uniqueResults.reduce(
            (acc, result) => {
              const filename = result.metadata.filename || "Unknown";
              if (!acc[filename]) acc[filename] = [];
              acc[filename].push(result);
              ragSources.add(filename);
              return acc;
            },
            {} as Record<string, typeof uniqueResults>,
          );

          // Format context with source grouping
          contextContent = Object.entries(resultsBySource)
            .map(([filename, results]) => {
              const chunks = results
                .map(
                  (r, i) =>
                    `  [Chunk ${i + 1}] (Relevance: ${(r.score * 100).toFixed(0)}%)\n  ${r.text}`,
                )
                .join("\n\n");
              return `## Source: ${filename}\n\n${chunks}`;
            })
            .join("\n\n---\n\n");

          ragResultsCount = uniqueResults.length;
          logger.info(
            `Found ${ragResultsCount} relevant chunks from ${ragSources.size} source files (after deduplication and filtering)`,
          );
        } else {
          logger.info(
            "No high-confidence documents found in RAG (threshold: 0.65)",
          );
        }
      } catch (error) {
        logger.warn("RAG search failed, continuing without context:", error);
      }
    }

    // Step 2: Generate presentation structure using AI with enhanced instructions
    const hasConversationContext = chatContext && chatContext.length > 0;

    const allowedLayoutLines = preferredLayouts
      .map((layout) => `- "${layout}": ${LAYOUT_LABELS[layout]}`)
      .join("\n");

    const systemPrompt = `You are a senior presentation designer tasked with creating a high-impact executive deck. Return a single valid JSON object that describes the entire presentation.

DESIGN OBJECTIVES:
- Provide a strong title and subtitle that frame the narrative.
- Build up to ${maxSlides} content slides (excluding the title). Deliver at least five excellent slides unless the topic truly lacks depth.
- Vary layouts so consecutive slides feel distinct. Use section breaks to introduce major shifts, KPI grids for metrics, and quotes for human impact.
- Every slide must include persuasive speaker notes that reference source filenames whenever external data is used and explain how the slide ties back to the ongoing conversation with the user.

${
  hasConversationContext
    ? `CONVERSATION CONTEXT IS PROVIDED. Honor all prior constraints, goals, and nuances shared by the user. The conversation is the single source of truth for tone, priorities, and must-have content. Mirror key language and resolve any ambiguities in favor of the user's stated preferences.`
    : ""
}

${
  contextContent
    ? `KNOWLEDGE BASE CONTEXT IS AVAILABLE. When citing data:
1. Blend knowledge base insights with the user's goals.
2. Pull exact statistics, trends, or quotes into slides.
3. Cite sources in speaker notes using the filename (e.g., "Source: revenue-cycle-report.pdf").`
    : `NO KNOWLEDGE BASE CONTEXT. Use accurate domain expertise, best practices, and actionable recommendations.`
}

LAYOUT PLAYBOOK (choose the layout that best conveys each idea):
- "section-break": Introduce a new chapter. Fields: title, optional eyebrow, description, highlights[] (≤4).
- "bullets": Core explanatory slide. Fields: title, optional eyebrow, bullets[] (3-5), supportingPoints[] (optional), kickerLeft/kickerRight for next steps or owners.
- "two-column": Comparisons, pro/con analyses, or process vs. outcome. Fields: title, optional eyebrow, leftColumn[], rightColumn[], optional rightTitle.
- "kpi-grid": Metrics snapshot. Fields: title, summary, metrics[] (≤3 entries with label/value/optional delta/description), footnotes[] (≤2 concise citations).
- "quote": Testimonial or voice-of-customer. Fields: title, optional eyebrow, quote, attribution, supportingPoints[].
- "comparison": Side-by-side findings. Fields: title, optional eyebrow, summary, tableTitle, columns[{ title, bullets[] }], optional footnotes[].
- "timeline": Sequential milestones. Fields: title, summary, milestones[{ date, title, description }], optional footnotes[].

CHOOSE FROM THESE LAYOUT TYPES ONLY (no other layout keys are permitted):
${allowedLayoutLines}

DATA RULES:
- Trim arrays to their limits (metrics ≤ 3, highlights ≤ 4, footnotes ≤ 2).
- Keep text concise but information-dense; avoid filler.
- Speaker notes must explain why the slide matters, add nuance, and cite sources when relevant.
- When conversation context exists, each slide's bullets or notes must explicitly reference at least one distinct idea from the conversation so the audience feels the through-line.

RETURN FORMAT (valid JSON only, no commentary or Markdown):
{
  "title": "Presentation Title",
  "subtitle": "Optional subtitle or null",
  "slides": [
    {
      "layout": "section-break",
      "title": "Section Name",
      "eyebrow": "Optional tag",
      "description": "Short paragraph framing the next section",
      "highlights": ["Key idea", "Another takeaway"],
      "notes": "Speaker notes with cited sources"
    },
    {
      "layout": "bullets",
      "title": "Core Topic",
      "eyebrow": "Optional context",
      "bullets": ["Primary point", "Supporting point", "Action item"],
      "supportingPoints": ["Deeper detail or evidence"],
      "kickerLeft": "Next Step",
      "kickerRight": "Owner / Date",
      "notes": "Notes referencing sources where applicable"
    },
    {
      "layout": "kpi-grid",
      "title": "Performance Snapshot",
      "summary": "One-line insight framing the KPIs",
      "metrics": [
        { "label": "Metric Name", "value": "123%", "delta": "+4%", "description": "Context" }
      ],
      "footnotes": ["Source: filename.pdf"],
      "notes": "Narrative explaining the metrics with citations"
    },
    {
      "layout": "comparison",
      "title": "Solution Comparison",
      "summary": "Contrast investment vs. benefit for each option",
      "columns": [
        { "title": "Option A", "bullets": ["Strength 1", "Strength 2"] },
        { "title": "Option B", "bullets": ["Strength 1", "Strength 2"] },
        { "title": "Option C", "bullets": ["Strength 1", "Strength 2"] }
      ],
      "footnotes": ["Source: comparison-report.pdf"],
      "notes": "Explain when to favor each option and reference sources."
    },
    {
      "layout": "timeline",
      "title": "Implementation Timeline",
      "summary": "Roadmap from pilot to enterprise rollout",
      "milestones": [
        { "date": "Q1", "title": "Pilot Launch", "description": "Deploy in 2 clinics" },
        { "date": "Q2", "title": "Scale", "description": "Expand to 10 hospitals" }
      ],
      "footnotes": ["Source: rollout-plan.xlsx"],
      "notes": "Highlight dependencies and reference stakeholder approvals."
    }
  ]
}`;

    // Build user prompt with chat context FIRST (most important)
    let userPrompt = "";

    // Add chat conversation context FIRST if available (highest priority)
    if (hasConversationContext) {
      const conversationSummary = chatContext
        .map((msg, index) => `[${index + 1}] ${msg.role.toUpperCase()}: ${msg.content}`)
        .join("\n");
      userPrompt += `## CONVERSATION CONTEXT (PRIORITY: Read this first!)\n\nThe user has been discussing this topic in detail. Here's the full conversation leading to this presentation request:\n\n${conversationSummary}\n\n`;

      const mostRecentUserMessage = [...chatContext]
        .reverse()
        .find((msg) => msg.role === "user");

      if (mostRecentUserMessage) {
        userPrompt += `## MOST RECENT USER REQUEST (DO NOT IGNORE)\n${mostRecentUserMessage.content.trim()}\n\n`;
      }

      userPrompt += `Based on this conversation, create a presentation about: "${prompt}"\n\nIMPORTANT: Explicitly tie each slide back to the conversation details above.`;
    } else {
      userPrompt = `Create a presentation about: "${prompt}"`;
    }

    // Add RAG context if available (second priority)
    if (contextContent) {
      userPrompt += `\n\n## RELEVANT DOCUMENTS FROM KNOWLEDGE BASE\n\nUse this curated content to support your presentation with data and facts:\n\n${contextContent}`;
    }

    logger.info("Calling AI to generate presentation structure");

    let text: string;
    try {
      const result = await generateText({
        model: openai("gpt-5"), // GPT-5 model for presentation generation
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.7,
      });
      text = result.text;
    } catch (aiError) {
      logger.error("AI generation failed:", aiError);
      return NextResponse.json(
        {
          error: "Failed to call AI model",
          details: aiError instanceof Error ? aiError.message : "Unknown AI error",
        },
        { status: 500 },
      );
    }

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
    await verifyPPTXIntegrity(
      pptxBuffer,
      presentationData.slides.length + 1,
    );

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

    // Step 6: Return download URL with enhanced metadata
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
        preferredLayouts,
        ragEnabled: useRAG,
        ragChunksUsed: ragResultsCount,
        ragSourcesUsed: ragSources.size,
        ragSources: Array.from(ragSources),
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
