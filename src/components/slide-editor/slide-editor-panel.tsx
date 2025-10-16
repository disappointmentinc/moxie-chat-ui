"use client";

import { appStore } from "@/app/store";
import { useShallow } from "zustand/shallow";
import { X, Download, Plus, Loader2 } from "lucide-react";
import { Button } from "ui/button";
import { ScrollArea } from "ui/scroll-area";
import { SlidePreviewCard } from "./slide-preview-card";
import { toast } from "sonner";
import { useState } from "react";
import { PresentationSlide } from "@/lib/pptx/pptx-builder";

export function SlideEditorPanel() {
  const [slideEditor, mutate] = appStore(
    useShallow((state) => [state.slideEditor, state.mutate])
  );

  const [isExporting, setIsExporting] = useState(false);

  const handleClose = () => {
    mutate({
      slideEditor: {
        ...slideEditor,
        isOpen: false,
      },
    });
  };

  const handleAddSlide = () => {
    if (!slideEditor.presentation) return;

    const newSlide: PresentationSlide = {
      layout: "bullets",
      title: "New Slide",
      bullets: ["Point 1", "Point 2", "Point 3"],
    };

    mutate({
      slideEditor: {
        ...slideEditor,
        presentation: {
          ...slideEditor.presentation,
          slides: [...slideEditor.presentation.slides, newSlide],
        },
      },
    });
  };

  const handleDeleteSlide = (index: number) => {
    if (!slideEditor.presentation) return;

    const updatedSlides = slideEditor.presentation.slides.filter(
      (_, i) => i !== index
    );

    mutate({
      slideEditor: {
        ...slideEditor,
        presentation: {
          ...slideEditor.presentation,
          slides: updatedSlides,
        },
        selectedSlideIndex:
          slideEditor.selectedSlideIndex === index
            ? null
            : slideEditor.selectedSlideIndex,
      },
    });

    toast.success("Slide deleted");
  };

  const handleUpdateSlide = (index: number, updatedSlide: PresentationSlide) => {
    if (!slideEditor.presentation) return;

    const updatedSlides = slideEditor.presentation.slides.map((slide, i) =>
      i === index ? updatedSlide : slide
    );

    mutate({
      slideEditor: {
        ...slideEditor,
        presentation: {
          ...slideEditor.presentation,
          slides: updatedSlides,
        },
      },
    });
  };

  const handleMoveSlide = (index: number, direction: "up" | "down") => {
    if (!slideEditor.presentation) return;

    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= slideEditor.presentation.slides.length)
      return;

    const slides = [...slideEditor.presentation.slides];
    [slides[index], slides[newIndex]] = [slides[newIndex], slides[index]];

    mutate({
      slideEditor: {
        ...slideEditor,
        presentation: {
          ...slideEditor.presentation,
          slides,
        },
      },
    });
  };

  const handleExport = async () => {
    if (!slideEditor.presentation) return;

    setIsExporting(true);

    try {
      const response = await fetch("/api/slide-editor/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presentation: slideEditor.presentation,
          theme: "healthrise",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to export presentation");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slideEditor.presentation.title || "presentation"}.pptx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Presentation exported successfully");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export presentation");
    } finally {
      setIsExporting(false);
    }
  };

  if (!slideEditor.isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-[600px] bg-background border-l border-border shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h2 className="text-lg font-semibold">Slide Editor</h2>
          {slideEditor.presentation && (
            <p className="text-sm text-muted-foreground">
              {slideEditor.presentation.slides.length} slides
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={isExporting || !slideEditor.presentation}
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            <span className="ml-2">Export PPTX</span>
          </Button>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 px-6 py-4">
        {slideEditor.isGenerating ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Generating slides from conversation...
            </p>
          </div>
        ) : slideEditor.presentation ? (
          <div className="space-y-4">
            {/* Title Slide */}
            <div className="bg-card rounded-lg border border-border p-4">
              <h3 className="font-semibold text-sm text-muted-foreground mb-2">
                Title Slide
              </h3>
              <input
                type="text"
                className="w-full px-3 py-2 text-xl font-bold bg-background border border-border rounded-md"
                value={slideEditor.presentation.title}
                onChange={(e) =>
                  mutate({
                    slideEditor: {
                      ...slideEditor,
                      presentation: {
                        ...slideEditor.presentation!,
                        title: e.target.value,
                      },
                    },
                  })
                }
                placeholder="Presentation Title"
              />
              {slideEditor.presentation.subtitle !== undefined && (
                <input
                  type="text"
                  className="w-full px-3 py-2 mt-2 bg-background border border-border rounded-md"
                  value={slideEditor.presentation.subtitle || ""}
                  onChange={(e) =>
                    mutate({
                      slideEditor: {
                        ...slideEditor,
                        presentation: {
                          ...slideEditor.presentation!,
                          subtitle: e.target.value,
                        },
                      },
                    })
                  }
                  placeholder="Subtitle (optional)"
                />
              )}
            </div>

            {/* Slides */}
            {slideEditor.presentation.slides.map((slide, index) => (
              <SlidePreviewCard
                key={index}
                slide={slide}
                index={index}
                isSelected={slideEditor.selectedSlideIndex === index}
                onSelect={() =>
                  mutate({
                    slideEditor: {
                      ...slideEditor,
                      selectedSlideIndex:
                        slideEditor.selectedSlideIndex === index ? null : index,
                    },
                  })
                }
                onUpdate={(updatedSlide) =>
                  handleUpdateSlide(index, updatedSlide)
                }
                onDelete={() => handleDeleteSlide(index)}
                onMoveUp={
                  index > 0 ? () => handleMoveSlide(index, "up") : undefined
                }
                onMoveDown={
                  index < slideEditor.presentation!.slides.length - 1
                    ? () => handleMoveSlide(index, "down")
                    : undefined
                }
              />
            ))}

            {/* Add Slide Button */}
            <Button
              variant="outline"
              className="w-full"
              onClick={handleAddSlide}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Slide
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">
              No presentation loaded
            </p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
