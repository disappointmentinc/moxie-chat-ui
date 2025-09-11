"use client";

import { LottieAnimation } from "./lottie-animation";
import { cn } from "lib/utils";

interface LottieEmptyStateProps {
  title: string;
  description?: string;
  animationType?: "ideas" | "growth" | "data-viz";
  className?: string;
  children?: React.ReactNode;
}

export function LottieEmptyState({ 
  title, 
  description, 
  animationType = "ideas",
  className,
  children 
}: LottieEmptyStateProps) {
  const getAnimationPath = () => {
    switch (animationType) {
      case "ideas":
        return "/animations/marketing/ideas.json";
      case "growth":
        return "/animations/marketing/growth.json";
      case "data-viz":
        return "/animations/data-viz/data-viz-dark.json";
      default:
        return "/animations/marketing/ideas.json";
    }
  };

  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-12 px-4 text-center",
      className
    )}>
      <div className="mb-6">
        <LottieAnimation
          animationPath={getAnimationPath()}
          size="xl"
          loop={true}
          autoplay={true}
          speed={0.8}
        />
      </div>
      <h3 className="text-lg font-medium text-foreground mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-6">
          {description}
        </p>
      )}
      {children}
    </div>
  );
}