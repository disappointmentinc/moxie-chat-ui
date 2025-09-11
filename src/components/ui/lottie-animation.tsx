"use client";

import { useEffect, useRef, useState } from "react";
import Lottie, { LottieRef } from "lottie-react";
import { cn } from "lib/utils";

interface LottieAnimationProps {
  animationPath: string;
  className?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  loop?: boolean;
  autoplay?: boolean;
  speed?: number;
  onComplete?: () => void;
}

const sizeClasses = {
  xs: "w-6 h-6",
  sm: "w-8 h-8", 
  md: "w-12 h-12",
  lg: "w-16 h-16",
  xl: "w-24 h-24",
};

export function LottieAnimation({
  animationPath,
  className,
  size = "md",
  loop = true,
  autoplay = true,
  speed = 1,
  onComplete,
}: LottieAnimationProps) {
  const lottieRef = useRef<LottieRef>(null);
  const [animationData, setAnimationData] = useState(null);

  useEffect(() => {
    const loadAnimation = async () => {
      try {
        const response = await fetch(animationPath);
        const data = await response.json();
        setAnimationData(data);
      } catch (error) {
        console.error("Failed to load animation:", error);
      }
    };

    loadAnimation();
  }, [animationPath]);

  useEffect(() => {
    if (lottieRef.current) {
      lottieRef.current.setSpeed(speed);
    }
  }, [speed]);

  const handleComplete = () => {
    onComplete?.();
  };

  if (!animationData) {
    return <div className={cn(sizeClasses[size], "animate-pulse bg-muted rounded", className)} />;
  }

  return (
    <div className={cn(sizeClasses[size], className)}>
      <Lottie
        lottieRef={lottieRef}
        animationData={animationData}
        loop={loop}
        autoplay={autoplay}
        onComplete={handleComplete}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}

export function LottieLoader({
  className,
  size = "md",
  variant = "01",
}: {
  className?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  variant?: "01" | "05" | "10";
}) {
  return (
    <LottieAnimation
      animationPath={`/animations/loaders/loader-${variant}.json`}
      className={className}
      size={size}
      loop={true}
      autoplay={true}
    />
  );
}

export function LottieIcon({
  icon,
  className,
  size = "sm",
  loop = false,
  autoplay = true,
}: {
  icon: "checkmark" | "cancel" | "settings" | "comment" | "alert-triangle" | "alert-circle" | "download" | "upload";
  className?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  loop?: boolean;
  autoplay?: boolean;
}) {
  const iconPaths = {
    checkmark: "/animations/ui-icons/checkmark-circle.json",
    cancel: "/animations/ui-icons/cancel-circle.json", 
    settings: "/animations/ui-icons/settings-gear.json",
    comment: "/animations/communication/comment.json",
    "alert-triangle": "/animations/ui-icons/alert-triangle.json",
    "alert-circle": "/animations/ui-icons/alert-circle.json",
    download: "/animations/ui-icons/download.json",
    upload: "/animations/ui-icons/upload.json",
  };

  return (
    <LottieAnimation
      animationPath={iconPaths[icon]}
      className={className}
      size={size}
      loop={loop}
      autoplay={autoplay}
    />
  );
}