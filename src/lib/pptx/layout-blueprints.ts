import type { SlideLayoutType } from "./pptx-builder";

export interface ShapeTargetDescriptor {
  name?: string;
  names?: string[];
  placeholder?: {
    type: string;
    index?: number;
  };
  fallbacks?: string[];
}

interface LayoutConstraints {
  bullets?: { maxItems: number };
  supporting?: { maxItems: number };
  highlights?: { maxItems: number };
  leftColumn?: { maxItems: number };
  rightColumn?: { maxItems: number };
  milestones?: { maxItems: number };
}

export interface LayoutBlueprint {
  shapes: {
    title?: ShapeTargetDescriptor;
    eyebrow?: ShapeTargetDescriptor;
    description?: ShapeTargetDescriptor;
    highlights?: ShapeTargetDescriptor;
    body?: ShapeTargetDescriptor;
    supporting?: ShapeTargetDescriptor;
    leftColumn?: ShapeTargetDescriptor;
    rightColumn?: ShapeTargetDescriptor;
    summaryCallout?: ShapeTargetDescriptor;
    summaryText?: ShapeTargetDescriptor;
    quote?: ShapeTargetDescriptor;
    attribution?: ShapeTargetDescriptor;
    timelineBody?: ShapeTargetDescriptor;
  };
  metricShapes?: string[];
  columnHeadingShapes?: string[];
  columnBodyShapes?: string[];
  footnoteShapes?: ShapeTargetDescriptor[];
  footerShapes?: ShapeTargetDescriptor[];
  constraints?: LayoutConstraints;
}

export const LAYOUT_BLUEPRINTS: Record<SlideLayoutType, LayoutBlueprint> = {
  "section-break": {
    shapes: {
      title: {
        placeholder: { type: "ctrTitle" },
        fallbacks: ["Title 5"],
      },
      description: {
        placeholder: { type: "body", index: 0 },
        fallbacks: ["TextBox 7"],
      },
      highlights: {
        placeholder: { type: "body", index: 1 },
        fallbacks: ["TextBox 8"],
      },
    },
    constraints: {
      highlights: { maxItems: 4 },
    },
  },
  bullets: {
    shapes: {
      eyebrow: {
        names: ["TextBox 27"],
      },
      title: {
        placeholder: { type: "title" },
        fallbacks: ["TextBox 14"],
      },
      body: {
        placeholder: { type: "body", index: 0 },
        fallbacks: ["TextBox 13"],
      },
      supporting: {
        names: ["TextBox 11"],
      },
    },
    footnoteShapes: [
      { placeholder: { type: "ftr", index: 0 }, fallbacks: ["TextBox 4"] },
      { placeholder: { type: "ftr", index: 1 }, fallbacks: ["TextBox 5"] },
    ],
    constraints: {
      bullets: { maxItems: 5 },
      supporting: { maxItems: 3 },
    },
  },
  "two-column": {
    shapes: {
      title: {
        placeholder: { type: "title" },
        fallbacks: ["TextBox 14"],
      },
      leftColumn: {
        placeholder: { type: "body", index: 0 },
        fallbacks: ["TextBox 13"],
      },
      rightColumn: {
        placeholder: { type: "body", index: 1 },
        fallbacks: ["TextBox 11"],
      },
      eyebrow: {
        names: ["TextBox 4"],
      },
    },
    footnoteShapes: [
      { placeholder: { type: "ftr", index: 0 }, fallbacks: ["TextBox 4"] },
      { placeholder: { type: "ftr", index: 1 }, fallbacks: ["TextBox 5"] },
    ],
    constraints: {
      leftColumn: { maxItems: 5 },
      rightColumn: { maxItems: 4 },
    },
  },
  "kpi-grid": {
    shapes: {
      title: {
        placeholder: { type: "title" },
        fallbacks: ["TextBox 14"],
      },
      summaryCallout: {
        names: ["Rounded Rectangle 35"],
      },
      summaryText: {
        names: ["TextBox 13"],
      },
    },
    metricShapes: ["TextBox 30", "TextBox 28", "TextBox 26"],
    footnoteShapes: [
      { placeholder: { type: "ftr", index: 0 }, fallbacks: ["TextBox 4"] },
      { placeholder: { type: "ftr", index: 1 }, fallbacks: ["TextBox 5"] },
    ],
  },
  quote: {
    shapes: {
      title: {
        names: ["TextBox 1"],
        placeholder: { type: "title" },
      },
      eyebrow: {
        names: ["TextBox 14"],
      },
      quote: {
        placeholder: { type: "body", index: 0 },
        fallbacks: ["TextBox 43"],
      },
      attribution: {
        names: ["TextBox 6"],
      },
    },
    footnoteShapes: [
      { placeholder: { type: "ftr", index: 0 }, fallbacks: ["TextBox 4"] },
      { placeholder: { type: "ftr", index: 1 }, fallbacks: ["TextBox 5"] },
    ],
  },
  comparison: {
    shapes: {
      title: {
        placeholder: { type: "title" },
        fallbacks: ["TextBox 14"],
      },
      eyebrow: {
        names: ["TextBox 1"],
      },
      summaryText: {
        names: ["TextBox 13"],
      },
      summaryCallout: {
        names: ["Rounded Rectangle 39"],
      },
    },
    columnHeadingShapes: ["TextBox 31", "TextBox 32", "TextBox 33"],
    columnBodyShapes: ["TextBox 34", "TextBox 35", "TextBox 38"],
    footnoteShapes: [
      { names: ["TextBox 45"] },
      { names: ["TextBox 46"] },
      { names: ["TextBox 47"] },
    ],
  },
  timeline: {
    shapes: {
      title: {
        placeholder: { type: "title" },
        fallbacks: ["TextBox 5"],
      },
      timelineBody: {
        placeholder: { type: "body", index: 0 },
        fallbacks: ["Text Placeholder 12"],
      },
    },
    footnoteShapes: [
      { names: ["TextBox 49"] },
      { names: ["TextBox 50"] },
    ],
    constraints: {
      milestones: { maxItems: 6 },
    },
  },
};
