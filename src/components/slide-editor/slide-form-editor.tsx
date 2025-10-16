"use client";

import {
  PresentationSlide,
  BulletSlide,
  TwoColumnSlide,
  KpiGridSlide,
  QuoteSlide,
  ComparisonSlide,
  TimelineSlide,
  SectionBreakSlide,
} from "@/lib/pptx/pptx-builder";
import { Label } from "ui/label";
import { Input } from "ui/input";
import { Textarea } from "ui/textarea";
import { Button } from "ui/button";
import { Plus, Trash2 } from "lucide-react";

interface SlideFormEditorProps {
  slide: PresentationSlide;
  onUpdate: (updatedSlide: PresentationSlide) => void;
}

export function SlideFormEditor({ slide, onUpdate }: SlideFormEditorProps) {
  const updateField = <K extends keyof PresentationSlide>(
    field: K,
    value: PresentationSlide[K]
  ) => {
    onUpdate({ ...slide, [field]: value });
  };

  const renderCommonFields = () => (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Title</Label>
        <Input
          value={slide.title}
          onChange={(e) => updateField("title", e.target.value)}
          className="mt-1"
        />
      </div>
      {slide.eyebrow !== undefined && (
        <div>
          <Label className="text-xs">Eyebrow (optional)</Label>
          <Input
            value={slide.eyebrow || ""}
            onChange={(e) => updateField("eyebrow", e.target.value)}
            className="mt-1"
            placeholder="Eyebrow text"
          />
        </div>
      )}
      {slide.notes !== undefined && (
        <div>
          <Label className="text-xs">Speaker Notes (optional)</Label>
          <Textarea
            value={slide.notes || ""}
            onChange={(e) => updateField("notes", e.target.value)}
            className="mt-1 min-h-[60px]"
            placeholder="Notes for the presenter"
          />
        </div>
      )}
    </div>
  );

  switch (slide.layout) {
    case "section-break": {
      const sectionSlide = slide as SectionBreakSlide;
      return (
        <div className="space-y-4">
          {renderCommonFields()}
          <div>
            <Label className="text-xs">Description (optional)</Label>
            <Textarea
              value={sectionSlide.description || ""}
              onChange={(e) =>
                onUpdate({ ...slide, description: e.target.value })
              }
              className="mt-1 min-h-[60px]"
              placeholder="Section description"
            />
          </div>
          <div>
            <Label className="text-xs">Highlights (optional)</Label>
            {(sectionSlide.highlights || []).map((highlight, index) => (
              <div key={index} className="flex gap-2 mt-2">
                <Input
                  value={highlight}
                  onChange={(e) => {
                    const highlights = [...(sectionSlide.highlights || [])];
                    highlights[index] = e.target.value;
                    onUpdate({ ...slide, highlights });
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    const highlights = (sectionSlide.highlights || []).filter(
                      (_, i) => i !== index
                    );
                    onUpdate({ ...slide, highlights });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => {
                const highlights = [
                  ...(sectionSlide.highlights || []),
                  "New highlight",
                ];
                onUpdate({ ...slide, highlights });
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Highlight
            </Button>
          </div>
        </div>
      );
    }

    case "bullets": {
      const bulletSlide = slide as BulletSlide;
      return (
        <div className="space-y-4">
          {renderCommonFields()}
          <div>
            <Label className="text-xs">Bullets</Label>
            {bulletSlide.bullets.map((bullet, index) => (
              <div key={index} className="flex gap-2 mt-2">
                <Textarea
                  value={bullet}
                  onChange={(e) => {
                    const bullets = [...bulletSlide.bullets];
                    bullets[index] = e.target.value;
                    onUpdate({ ...slide, bullets });
                  }}
                  className="min-h-[60px]"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    const bullets = bulletSlide.bullets.filter(
                      (_, i) => i !== index
                    );
                    onUpdate({ ...slide, bullets });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => {
                const bullets = [...bulletSlide.bullets, "New bullet point"];
                onUpdate({ ...slide, bullets });
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Bullet
            </Button>
          </div>
        </div>
      );
    }

    case "two-column": {
      const twoColSlide = slide as TwoColumnSlide;
      return (
        <div className="space-y-4">
          {renderCommonFields()}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Left Column</Label>
              {twoColSlide.leftColumn.map((item, index) => (
                <div key={index} className="flex gap-2 mt-2">
                  <Textarea
                    value={item}
                    onChange={(e) => {
                      const leftColumn = [...twoColSlide.leftColumn];
                      leftColumn[index] = e.target.value;
                      onUpdate({ ...slide, leftColumn });
                    }}
                    className="min-h-[60px]"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      const leftColumn = twoColSlide.leftColumn.filter(
                        (_, i) => i !== index
                      );
                      onUpdate({ ...slide, leftColumn });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  const leftColumn = [...twoColSlide.leftColumn, "New item"];
                  onUpdate({ ...slide, leftColumn });
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>
            <div>
              <Label className="text-xs">Right Column</Label>
              {twoColSlide.rightColumn.map((item, index) => (
                <div key={index} className="flex gap-2 mt-2">
                  <Textarea
                    value={item}
                    onChange={(e) => {
                      const rightColumn = [...twoColSlide.rightColumn];
                      rightColumn[index] = e.target.value;
                      onUpdate({ ...slide, rightColumn });
                    }}
                    className="min-h-[60px]"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      const rightColumn = twoColSlide.rightColumn.filter(
                        (_, i) => i !== index
                      );
                      onUpdate({ ...slide, rightColumn });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  const rightColumn = [...twoColSlide.rightColumn, "New item"];
                  onUpdate({ ...slide, rightColumn });
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>
          </div>
        </div>
      );
    }

    case "kpi-grid": {
      const kpiSlide = slide as KpiGridSlide;
      return (
        <div className="space-y-4">
          {renderCommonFields()}
          <div>
            <Label className="text-xs">Summary (optional)</Label>
            <Textarea
              value={kpiSlide.summary || ""}
              onChange={(e) => onUpdate({ ...slide, summary: e.target.value })}
              className="mt-1 min-h-[60px]"
              placeholder="Summary text"
            />
          </div>
          <div>
            <Label className="text-xs">Metrics</Label>
            {kpiSlide.metrics.map((metric, index) => (
              <div key={index} className="border rounded-md p-3 mt-2 space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={metric.label}
                    onChange={(e) => {
                      const metrics = [...kpiSlide.metrics];
                      metrics[index] = { ...metric, label: e.target.value };
                      onUpdate({ ...slide, metrics });
                    }}
                    placeholder="Label"
                  />
                  <Input
                    value={metric.value}
                    onChange={(e) => {
                      const metrics = [...kpiSlide.metrics];
                      metrics[index] = { ...metric, value: e.target.value };
                      onUpdate({ ...slide, metrics });
                    }}
                    placeholder="Value"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      const metrics = kpiSlide.metrics.filter(
                        (_, i) => i !== index
                      );
                      onUpdate({ ...slide, metrics });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Input
                  value={metric.delta || ""}
                  onChange={(e) => {
                    const metrics = [...kpiSlide.metrics];
                    metrics[index] = { ...metric, delta: e.target.value };
                    onUpdate({ ...slide, metrics });
                  }}
                  placeholder="Delta (optional, e.g., +15%)"
                  className="text-sm"
                />
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => {
                const metrics = [
                  ...kpiSlide.metrics,
                  { label: "New Metric", value: "0" },
                ];
                onUpdate({ ...slide, metrics });
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Metric
            </Button>
          </div>
        </div>
      );
    }

    case "quote": {
      const quoteSlide = slide as QuoteSlide;
      return (
        <div className="space-y-4">
          {renderCommonFields()}
          <div>
            <Label className="text-xs">Quote</Label>
            <Textarea
              value={quoteSlide.quote}
              onChange={(e) => onUpdate({ ...slide, quote: e.target.value })}
              className="mt-1 min-h-[80px]"
              placeholder="Quote text"
            />
          </div>
          <div>
            <Label className="text-xs">Attribution (optional)</Label>
            <Input
              value={quoteSlide.attribution || ""}
              onChange={(e) =>
                onUpdate({ ...slide, attribution: e.target.value })
              }
              className="mt-1"
              placeholder="— Author Name"
            />
          </div>
        </div>
      );
    }

    case "comparison": {
      const compSlide = slide as ComparisonSlide;
      return (
        <div className="space-y-4">
          {renderCommonFields()}
          <div>
            <Label className="text-xs">Summary (optional)</Label>
            <Textarea
              value={compSlide.summary || ""}
              onChange={(e) => onUpdate({ ...slide, summary: e.target.value })}
              className="mt-1 min-h-[60px]"
              placeholder="Summary text"
            />
          </div>
          <div>
            <Label className="text-xs">Columns</Label>
            {compSlide.columns.map((column, colIndex) => (
              <div key={colIndex} className="border rounded-md p-3 mt-2 space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={column.title}
                    onChange={(e) => {
                      const columns = [...compSlide.columns];
                      columns[colIndex] = {
                        ...column,
                        title: e.target.value,
                      };
                      onUpdate({ ...slide, columns });
                    }}
                    placeholder="Column title"
                    className="font-medium"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      const columns = compSlide.columns.filter(
                        (_, i) => i !== colIndex
                      );
                      onUpdate({ ...slide, columns });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {column.bullets.map((bullet, bulletIndex) => (
                  <div key={bulletIndex} className="flex gap-2 ml-4">
                    <Input
                      value={bullet}
                      onChange={(e) => {
                        const columns = [...compSlide.columns];
                        const bullets = [...column.bullets];
                        bullets[bulletIndex] = e.target.value;
                        columns[colIndex] = { ...column, bullets };
                        onUpdate({ ...slide, columns });
                      }}
                      placeholder="Bullet point"
                      className="text-sm"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const columns = [...compSlide.columns];
                        const bullets = column.bullets.filter(
                          (_, i) => i !== bulletIndex
                        );
                        columns[colIndex] = { ...column, bullets };
                        onUpdate({ ...slide, columns });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-4"
                  onClick={() => {
                    const columns = [...compSlide.columns];
                    columns[colIndex] = {
                      ...column,
                      bullets: [...column.bullets, "New bullet"],
                    };
                    onUpdate({ ...slide, columns });
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Bullet
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => {
                const columns = [
                  ...compSlide.columns,
                  { title: "New Column", bullets: ["Point 1"] },
                ];
                onUpdate({ ...slide, columns });
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Column
            </Button>
          </div>
        </div>
      );
    }

    case "timeline": {
      const timelineSlide = slide as TimelineSlide;
      return (
        <div className="space-y-4">
          {renderCommonFields()}
          <div>
            <Label className="text-xs">Summary (optional)</Label>
            <Textarea
              value={timelineSlide.summary || ""}
              onChange={(e) => onUpdate({ ...slide, summary: e.target.value })}
              className="mt-1 min-h-[60px]"
              placeholder="Summary text"
            />
          </div>
          <div>
            <Label className="text-xs">Milestones</Label>
            {timelineSlide.milestones.map((milestone, index) => (
              <div key={index} className="border rounded-md p-3 mt-2 space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={milestone.title}
                    onChange={(e) => {
                      const milestones = [...timelineSlide.milestones];
                      milestones[index] = {
                        ...milestone,
                        title: e.target.value,
                      };
                      onUpdate({ ...slide, milestones });
                    }}
                    placeholder="Milestone title"
                    className="font-medium flex-1"
                  />
                  <Input
                    value={milestone.date || ""}
                    onChange={(e) => {
                      const milestones = [...timelineSlide.milestones];
                      milestones[index] = {
                        ...milestone,
                        date: e.target.value,
                      };
                      onUpdate({ ...slide, milestones });
                    }}
                    placeholder="Date"
                    className="w-32"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      const milestones = timelineSlide.milestones.filter(
                        (_, i) => i !== index
                      );
                      onUpdate({ ...slide, milestones });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Textarea
                  value={milestone.description || ""}
                  onChange={(e) => {
                    const milestones = [...timelineSlide.milestones];
                    milestones[index] = {
                      ...milestone,
                      description: e.target.value,
                    };
                    onUpdate({ ...slide, milestones });
                  }}
                  placeholder="Description (optional)"
                  className="text-sm min-h-[50px]"
                />
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => {
                const milestones = [
                  ...timelineSlide.milestones,
                  { title: "New Milestone" },
                ];
                onUpdate({ ...slide, milestones });
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Milestone
            </Button>
          </div>
        </div>
      );
    }

    default:
      return <div>Unknown slide layout</div>;
  }
}
