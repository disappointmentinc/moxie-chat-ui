import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import JSZip from "jszip";
import { generatePPTX } from "../pptx-builder";
import type { PresentationData } from "../pptx-builder";
import { verifyPPTXIntegrity } from "../pptx-integrity";

describe("generatePPTX template flow", () => {
  it("creates a deck with mapped layouts and notes", async () => {
    const data: PresentationData = {
      title: "Revenue Transformation Strategy",
      subtitle: "FY26 Healthrise Outlook",
      slides: [
        {
          layout: "section-break",
          title: "Executive Overview",
          eyebrow: "FY26 Focus",
          description:
            "Realign revenue operations around digital intake and denial remediation.",
          highlights: [
            "Stabilize core revenue operations",
            "Accelerate self-service adoption",
          ],
          notes:
            "Open the conversation by framing FY26 as a transformation year. Reinforce urgency using leadership talking points.",
        },
        {
          layout: "bullets",
          title: "Top Challenges",
          eyebrow: "Current State",
          bullets: [
            "Denied claims increased 18% YoY due to coding variability.",
            "Manual pre-authorization queues exceed 36 hours in three markets.",
            "Aging AR is concentrated in self-pay balances over 120 days.",
          ],
          supportingPoints: [
            "Source: finance-report.pdf (Q3 revenue analysis).",
            "Source: denial-benchmark.xlsx (benchmark comparison).",
          ],
          kickerLeft: "Mitigation Plan",
          kickerRight: "Ops PMO",
          notes:
            "Use finance-report.pdf and denial-benchmark.xlsx to validate the pain points. Close by highlighting cross-functional accountability.",
        },
        {
          layout: "two-column",
          title: "Transformation Priorities",
          eyebrow: "12-Month Roadmap",
          leftColumn: [
            "Launch centralized denial prevention squad.",
            "Deploy AI-enabled coding assistant to 6 regions.",
            "Expand digital intake to 80% of ambulatory sites.",
          ],
          rightColumn: [
            "Reduce denial write-offs by 6 pts.",
            "Cut manual touches per claim by 30%.",
            "Improve patient payment conversion by 12 pts.",
          ],
          rightTitle: "Expected Outcomes",
          notes:
            "Source: transformation-playbook.docx — tie initiatives to measurable benefits for credibility.",
        },
        {
          layout: "kpi-grid",
          title: "Performance Snapshot",
          summary: "Core revenue cycle indicators rebounded after the pilot.",
          metrics: [
            {
              label: "Net Collection Rate",
              value: "96.4%",
              delta: "+2.1 pts",
              description: "vs. FY25 Q4 baseline",
            },
            {
              label: "AR Days",
              value: "37",
              delta: "-5 days",
              description: "Target ≤ 35",
            },
            {
              label: "Clean Claim Rate",
              value: "94%",
              delta: "+6 pts",
            },
          ],
          footnotes: ["Source: finance-report.pdf"],
          notes:
            "Walk the audience through each KPI, referencing finance-report.pdf as the source.",
        },
        {
          layout: "quote",
          title: "Voice of the COO",
          eyebrow: "Pilot Feedback",
          quote:
            "The new digital intake experience cut wait times in half and improved our net promoter score almost overnight.",
          attribution: "COO, Valley Health",
          supportingPoints: ["Pilot site NPS increased by 18 points."],
          notes:
            "Source: customer-interviews.md — Use this quote to humanize the metrics and reinforce adoption momentum.",
        },
        {
          layout: "comparison",
          title: "Vendor Comparison",
          summary: "Relative strengths and trade-offs measured during the pilot.",
          tableTitle: "Evaluation Snapshot",
          columns: [
            {
              title: "Vendor A",
              bullets: [
                "Best in class automation for denial routing.",
                "Higher implementation fee but 6-week timeline.",
              ],
            },
            {
              title: "Vendor B",
              bullets: [
                "Lowest cost per claim processed.",
                "Limited analytics without premium add-on.",
              ],
            },
            {
              title: "Vendor C",
              bullets: [
                "Strong Epic integration pattern.",
                "Needs custom work for Medicaid workflows.",
              ],
            },
          ],
          footnotes: [
            "Source: vendor-rfp-eval.pdf",
            "Source: pilot-scorecard.xlsx",
          ],
          notes:
            "Summarize when each vendor is the best fit. Highlight the weighted score outputs pulled from vendor-rfp-eval.pdf.",
        },
        {
          layout: "timeline",
          title: "Deployment Timeline",
          summary: "Roadmap from discovery through enterprise rollout.",
          milestones: [
            {
              date: "Q1 FY26",
              title: "Discovery & Alignment",
              description: "Finalize success metrics and readiness with revenue ops.",
            },
            {
              date: "Q2 FY26",
              title: "Pilot Expansion",
              description: "Scale digital intake to top 10 clinics and measure throughput.",
            },
            {
              date: "Q3 FY26",
              title: "Enterprise Rollout",
              description: "Deploy automation toolkit to all hospitals with hypercare.",
            },
          ],
          footnotes: ["Source: program-roadmap.mpp"],
          notes:
            "Reference the program-roadmap.mpp milestones and call out critical dependencies for each phase.",
        },
      ],
    };
    const buffer = await generatePPTX(data, {
      useTemplate: true,
      includeFooter: false,
      theme: "healthrise",
    });
    await verifyPPTXIntegrity(buffer, data.slides.length + 1);

    expect(buffer.byteLength).toBeGreaterThan(4_000);

    const zip = await JSZip.loadAsync(buffer);
    const slidePaths = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      .sort();

    // Title slide plus content slides.
    expect(slidePaths.length).toBe(data.slides.length + 1);

    const sectionSlide = await zip
      .file("ppt/slides/slide2.xml")!
      .async("string");
    expect(sectionSlide).toContain("Executive Overview");

    const bulletSlide = await zip
      .file("ppt/slides/slide3.xml")!
      .async("string");
    expect(bulletSlide).toContain("Denied claims increased 18% YoY");
    expect(bulletSlide).toContain("Ops PMO");

    const notesSlide = await zip
      .file("ppt/notesSlides/notesSlide3.xml")!
      .async("string");
    expect(notesSlide).toContain("finance-report.pdf");

    const comparisonSlide = await zip
      .file("ppt/slides/slide7.xml")!
      .async("string");
    expect(comparisonSlide).toContain("Vendor A");
    expect(comparisonSlide).toContain("Evaluation Snapshot");

    const timelineSlide = await zip
      .file("ppt/slides/slide8.xml")!
      .async("string");
    expect(timelineSlide).toContain("Deployment Timeline");
    expect(timelineSlide).toContain("Q3 FY26");

    const contentTypes = await zip.file("[Content_Types].xml")!.async("string");
    expect(contentTypes).toContain("/ppt/slides/slide8.xml");
    expect(contentTypes).toContain("/ppt/notesSlides/notesSlide3.xml");
  });
});
