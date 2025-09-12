import { Think } from "ui/think";
import { getTranslations } from "next-intl/server";
import { FlipWords } from "ui/flip-words";
import { BackgroundPaths } from "ui/background-paths";
import { LottieAnimation } from "@/components/ui/lottie-animation";

export default async function AuthLayout({
  children,
}: { children: React.ReactNode }) {
  const t = await getTranslations("Auth.Intro");
  return (
    <main className="relative w-full flex flex-col h-screen">
      <div className="flex-1">
        <div className="flex min-h-screen w-full">
          <div className="hidden lg:flex lg:w-1/2 border-r flex-col p-18 relative" style={{backgroundColor: '#0f1d42'}}>
            <div className="absolute inset-0 w-full h-full">
              <BackgroundPaths />
            </div>
            <div className="absolute bottom-20 right-8 opacity-20">
              <LottieAnimation
                animationPath="/animations/data-viz/data-viz-dark.json"
                size="xl"
                loop={true}
                autoplay={true}
                speed={0.5}
              />
            </div>
            <h1 className="text-xl font-semibold flex items-center gap-3 animate-in fade-in duration-1000 font-sans">
              <Think />

              <span>Velocity RAG Beta 1.2</span>
            </h1>
            <div className="flex-1" />
            <FlipWords
              words={[t("description")]}
              className=" mb-4 text-muted-foreground"
            />
            <div className="text-[10px] leading-snug text-muted-foreground mt-2 font-sans">
              Velocity RAG Beta 1.2
            </div>
          </div>

          <div className="w-full lg:w-1/2 p-6">{children}</div>
        </div>
      </div>
    </main>
  );
}
