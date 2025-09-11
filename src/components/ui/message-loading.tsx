import { LottieLoader } from "./lottie-animation";

function MessageLoading({ className }: { className?: string }) {
  return (
    <LottieLoader
      className={className}
      size="sm"
      variant="01"
    />
  );
}

export { MessageLoading };
