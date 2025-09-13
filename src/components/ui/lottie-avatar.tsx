"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "lib/utils";
import { LottieIcon } from "./lottie-animation";

interface LottieAvatarProps
  extends React.ComponentProps<typeof AvatarPrimitive.Root> {
  src?: string;
  alt?: string;
  fallbackText?: string;
  useLottie?: boolean;
}

function LottieAvatar({
  className,
  src,
  alt = "",
  fallbackText = "",
  useLottie = true,
  ...props
}: LottieAvatarProps) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        "relative flex size-8 shrink-0 overflow-hidden rounded-full",
        className,
      )}
      {...props}
    >
      {src && (
        <AvatarPrimitive.Image
          data-slot="avatar-image"
          className="aspect-square size-full object-cover"
          src={src}
          alt={alt}
        />
      )}
      <AvatarPrimitive.Fallback
        data-slot="avatar-fallback"
        className="bg-muted flex size-full items-center justify-center rounded-full"
      >
        {useLottie ? (
          <LottieIcon
            icon="user-profile"
            size={
              className?.includes("size-8") || className?.includes("h-8 w-8")
                ? "xs"
                : "sm"
            }
            loop={true}
            autoplay={true}
            className="opacity-70"
          />
        ) : (
          fallbackText || "U"
        )}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

// Enhanced version with more control
interface EnhancedLottieAvatarProps extends LottieAvatarProps {
  showLottieOnHover?: boolean;
}

function EnhancedLottieAvatar({
  showLottieOnHover = false,
  ...props
}: EnhancedLottieAvatarProps) {
  const [isHovered, setIsHovered] = React.useState(false);

  if (showLottieOnHover) {
    return (
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="inline-block"
      >
        <LottieAvatar {...props} useLottie={isHovered || !props.src} />
      </div>
    );
  }

  return <LottieAvatar {...props} />;
}

export { LottieAvatar, EnhancedLottieAvatar };
