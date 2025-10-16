"use client";

import { PresentationSlide } from "@/lib/pptx/pptx-builder";
import { ChevronDown, ChevronUp, Trash2, Grip } from "lucide-react";
import { Button } from "ui/button";
import { SlideFormEditor } from "./slide-form-editor";

interface SlidePreviewCardProps {
  slide: PresentationSlide;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updatedSlide: PresentationSlide) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export function SlidePreviewCard({
  slide,
  index,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
}: SlidePreviewCardProps) {
  const getLayoutBadgeColor = (layout: PresentationSlide["layout"]) => {
    const colors: Record<PresentationSlide["layout"], string> = {
      "section-break": "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
      "bullets": "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
      "two-column": "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
      "kpi-grid": "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
      "quote": "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300",
      "comparison": "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300",
      "timeline": "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
    };
    return colors[layout];
  };

  const getLayoutDisplayName = (layout: PresentationSlide["layout"]) => {
    const names: Record<PresentationSlide["layout"], string> = {
      "section-break": "Section Break",
      "bullets": "Bullets",
      "two-column": "Two Column",
      "kpi-grid": "KPI Grid",
      "quote": "Quote",
      "comparison": "Comparison",
      "timeline": "Timeline",
    };
    return names[layout];
  };

  return (
    <div
      className={`bg-card rounded-lg border ${
        isSelected ? "border-primary ring-2 ring-primary/20" : "border-border"
      } overflow-hidden transition-all`}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={onSelect}
      >
        <div className="flex items-center gap-3 flex-1">
          <Grip className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">
            #{index + 1}
          </span>
          <span
            className={`px-2 py-0.5 text-xs font-medium rounded-full ${getLayoutBadgeColor(slide.layout)}`}
          >
            {getLayoutDisplayName(slide.layout)}
          </span>
          <span className="text-sm font-medium truncate">{slide.title}</span>
        </div>

        <div className="flex items-center gap-1">
          {onMoveUp && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                onMoveUp();
              }}
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
          )}
          {onMoveDown && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                onMoveDown();
              }}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Expanded Editor */}
      {isSelected && (
        <div className="border-t border-border px-4 py-4 bg-accent/20">
          <SlideFormEditor slide={slide} onUpdate={onUpdate} />
        </div>
      )}
    </div>
  );
}
