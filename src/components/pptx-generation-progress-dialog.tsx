"use client";

import { CheckCircle2, Download, Loader2, XIcon } from "lucide-react";
import { Button } from "ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "ui/dialog";
import { Progress } from "ui/progress";

export type PPTXGenerationStage =
  | "searching"
  | "generating"
  | "creating"
  | "uploading"
  | "complete"
  | "error";

export interface PPTXGenerationProgress {
  stage: PPTXGenerationStage;
  progress: number; // 0-100
  message: string;
  downloadUrl?: string;
  filename?: string;
  metadata?: {
    title: string;
    slideCount: number;
    ragChunksUsed?: number;
    ragSourcesUsed?: number;
  };
  error?: string;
}

interface PPTXGenerationProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  progress: PPTXGenerationProgress;
  onDownload?: () => void;
}

const stageInfo: Record<
  PPTXGenerationStage,
  { label: string; color: string; icon: typeof Loader2 }
> = {
  searching: {
    label: "Searching documents",
    color: "text-blue-500",
    icon: Loader2,
  },
  generating: {
    label: "Generating content",
    color: "text-purple-500",
    icon: Loader2,
  },
  creating: {
    label: "Creating presentation",
    color: "text-orange-500",
    icon: Loader2,
  },
  uploading: {
    label: "Uploading file",
    color: "text-green-500",
    icon: Loader2,
  },
  complete: {
    label: "Complete!",
    color: "text-green-600",
    icon: CheckCircle2,
  },
  error: {
    label: "Error",
    color: "text-red-600",
    icon: XIcon,
  },
};

export function PPTXGenerationProgressDialog({
  open,
  onOpenChange,
  progress,
  onDownload,
}: PPTXGenerationProgressDialogProps) {
  const currentStage = stageInfo[progress.stage];
  const Icon = currentStage.icon;
  const isAnimating = progress.stage !== "complete" && progress.stage !== "error";

  const handleDownload = () => {
    if (progress.downloadUrl) {
      // Create a temporary link and click it
      const link = document.createElement("a");
      link.href = progress.downloadUrl;
      link.download = progress.filename || "presentation.pptx";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      onDownload?.();
    }
  };

  const handleClose = () => {
    // Only allow closing when complete or error
    if (progress.stage === "complete" || progress.stage === "error") {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-[500px]"
        // Prevent closing during generation
        onPointerDownOutside={(e) => {
          if (progress.stage !== "complete" && progress.stage !== "error") {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          if (progress.stage !== "complete" && progress.stage !== "error") {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon
              className={`size-5 ${currentStage.color} ${isAnimating ? "animate-spin" : ""}`}
            />
            {progress.stage === "complete"
              ? "Presentation Ready"
              : progress.stage === "error"
                ? "Generation Failed"
                : "Generating Presentation"}
          </DialogTitle>
          <DialogDescription>
            {progress.stage === "complete"
              ? "Your presentation has been generated successfully!"
              : progress.stage === "error"
                ? "An error occurred during generation."
                : "Please wait while we generate your presentation..."}
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          {/* Progress bar */}
          <div className="mb-4">
            <Progress value={progress.progress} className="h-2" />
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className={currentStage.color}>{currentStage.label}</span>
              <span className="text-muted-foreground">{progress.progress}%</span>
            </div>
          </div>

          {/* Current message */}
          <div className="rounded-lg bg-muted p-4">
            <p className="text-sm text-muted-foreground">{progress.message}</p>
          </div>

          {/* Metadata when complete */}
          {progress.stage === "complete" && progress.metadata && (
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Title:</span>
                <span className="font-medium">{progress.metadata.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Slides:</span>
                <span className="font-medium">{progress.metadata.slideCount}</span>
              </div>
              {progress.metadata.ragChunksUsed !== undefined &&
                progress.metadata.ragChunksUsed > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sources used:</span>
                    <span className="font-medium">
                      {progress.metadata.ragChunksUsed} chunks from{" "}
                      {progress.metadata.ragSourcesUsed} source
                      {progress.metadata.ragSourcesUsed !== 1 ? "s" : ""}
                    </span>
                  </div>
                )}
            </div>
          )}

          {/* Error message */}
          {progress.stage === "error" && progress.error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
              <p className="text-sm text-red-800 dark:text-red-200">
                {progress.error}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          {progress.stage === "complete" && progress.downloadUrl && (
            <Button onClick={handleDownload} className="w-full">
              <Download className="mr-2 size-4" />
              Download Presentation
            </Button>
          )}

          {(progress.stage === "complete" || progress.stage === "error") && (
            <Button variant="outline" onClick={handleClose} className="w-full">
              Close
            </Button>
          )}

          {progress.stage !== "complete" && progress.stage !== "error" && (
            <div className="w-full text-center text-sm text-muted-foreground">
              Please keep this window open...
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
