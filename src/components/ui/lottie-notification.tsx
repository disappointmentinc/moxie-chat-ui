"use client";

import { LottieIcon } from "./lottie-animation";
import { cn } from "lib/utils";

interface LottieNotificationProps {
  type: "success" | "error" | "warning" | "info";
  title: string;
  description?: string;
  className?: string;
  onClose?: () => void;
}

export function LottieNotification({ 
  type, 
  title, 
  description, 
  className,
  onClose 
}: LottieNotificationProps) {
  const getIconAndColors = () => {
    switch (type) {
      case "success":
        return {
          icon: "checkmark" as const,
          bgClass: "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800",
          textClass: "text-green-800 dark:text-green-200",
          titleClass: "text-green-900 dark:text-green-100"
        };
      case "error":
        return {
          icon: "cancel" as const,
          bgClass: "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800",
          textClass: "text-red-800 dark:text-red-200",
          titleClass: "text-red-900 dark:text-red-100"
        };
      case "warning":
        return {
          icon: "alert-triangle" as const,
          bgClass: "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800",
          textClass: "text-yellow-800 dark:text-yellow-200",
          titleClass: "text-yellow-900 dark:text-yellow-100"
        };
      case "info":
        return {
          icon: "alert-circle" as const,
          bgClass: "bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800",
          textClass: "text-blue-800 dark:text-blue-200",
          titleClass: "text-blue-900 dark:text-blue-100"
        };
    }
  };

  const { icon, bgClass, textClass, titleClass } = getIconAndColors();

  return (
    <div
      className={cn(
        "relative rounded-lg border p-4 animate-in fade-in slide-in-from-top-5 duration-500",
        bgClass,
        className
      )}
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <LottieIcon
            icon={icon}
            size="sm"
            loop={false}
            autoplay={true}
          />
        </div>
        <div className="flex-1 space-y-1">
          <h4 className={cn("text-sm font-medium", titleClass)}>
            {title}
          </h4>
          {description && (
            <p className={cn("text-sm", textClass)}>
              {description}
            </p>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className={cn(
              "flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity",
              textClass
            )}
          >
            <LottieIcon
              icon="cancel"
              size="xs"
              loop={false}
              autoplay={false}
            />
          </button>
        )}
      </div>
    </div>
  );
}

export function LottieToast({ 
  type, 
  title, 
  description 
}: { 
  type: "success" | "error" | "warning" | "info";
  title: string;
  description?: string;
}) {
  return (
    <LottieNotification
      type={type}
      title={title}
      description={description}
      className="max-w-sm"
    />
  );
}