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
  chatContext?: Array<{ role: string; content: string }>; // Recent conversation history
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
    const {
      prompt,
      useRAG = true,
      theme = "healthrise",
      maxSlides = 20,
      chatContext = [],
    } = body;

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

    const systemPrompt = `You are a professional presentation designer creating a high-quality business presentation. Your task is to create a well-structured presentation outline in JSON format.

PRESENTATION REQUIREMENTS:
- Create a compelling title and subtitle
- Generate exactly ${maxSlides} content slides (excluding title slide)
- Each slide should have:
  * A clear, engaging title
  * 3-5 concise bullet points OR key data points
  * Detailed speaker notes with context and sources
- Use professional business language
- Make content actionable and audience-focused

${
  hasConversationContext
    ? `⚠️ IMPORTANT - CONVERSATION CONTEXT AVAILABLE:
The user has been having an ongoing conversation about this topic. The CONVERSATION CONTEXT section below contains the full chat history leading up to this presentation request. This context is CRITICAL for understanding:
- What the user has already discussed and learned
- Specific details, requirements, or preferences mentioned
- Key insights, data, or conclusions from the conversation
- The user's goals and intended audience for this presentation

YOU MUST carefully read and integrate insights from the conversation context to make this presentation relevant and aligned with what was discussed.`
    : ""
}

${
  contextContent
    ? `KNOWLEDGE BASE CONTEXT:
You have access to ${ragResultsCount} relevant document chunks from ${ragSources.size} source files. Use this information to create data-driven, well-researched content.

CONTENT GUIDELINES:
1. Prioritize factual information and specific data from the sources
2. Include statistics, metrics, and concrete examples when available
3. Cite sources in speaker notes (e.g., "According to [filename]...")
4. If sources contain data tables or numbers, incorporate them as bullet points
5. Use diverse sources to provide comprehensive coverage
6. Add speaker notes with additional context and full source citations

The provided context is organized by source file. Pay attention to relevance scores - higher scores indicate more relevant content.`
    : `GENERAL KNOWLEDGE MODE:
Create presentation based on your general knowledge about the topic. Focus on:
- Industry best practices and common frameworks
- Key concepts and foundational information
- Practical recommendations and actionable insights`
}

CONTENT PRIORITY ORDER:
1. ${hasConversationContext ? "Insights and details from the CONVERSATION CONTEXT (what the user specifically discussed)" : "User's topic request"}
2. ${contextContent ? "Factual data from KNOWLEDGE BASE documents" : "General knowledge and best practices"}
3. ${contextContent && hasConversationContext ? "General knowledge to fill gaps" : "Additional context as needed"}

REQUIRED JSON FORMAT (return ONLY valid JSON, no additional text):
{
  "title": "Presentation Title",
  "subtitle": "Optional Subtitle (can be null)",
  "slides": [
    {
      "title": "Slide Title",
      "content": ["Bullet point 1", "Bullet point 2", "Bullet point 3"],
      "notes": "Detailed speaker notes with context, explanations, and source citations if applicable"
    }
  ]
}`;

    // Build user prompt with chat context FIRST (most important)
    let userPrompt = "";

    // Add chat conversation context FIRST if available (highest priority)
    if (hasConversationContext) {
      const conversationSummary = chatContext
        .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
        .join("\n");
      userPrompt += `## CONVERSATION CONTEXT (PRIORITY: Read this first!)\n\nThe user has been discussing this topic in detail. Here's the full conversation leading to this presentation request:\n\n${conversationSummary}\n\n`;
      userPrompt += `Based on this conversation, create a presentation about: "${prompt}"\n\nIMPORTANT: The presentation should reflect the specific details, insights, and direction established in the conversation above.`;
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
