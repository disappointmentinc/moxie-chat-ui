"use client";

import { LottieAvatar, EnhancedLottieAvatar } from "@/components/ui/lottie-avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AvatarDemoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            🎭 Animated User Avatars
          </h1>
          <p className="text-slate-300">
            Lottie-powered user avatars that bring personality to your UI
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Basic Lottie Avatar */}
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle className="text-white">Basic Lottie Avatar</CardTitle>
              <CardDescription className="text-slate-300">
                Always shows Lottie animation when no image is provided
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <LottieAvatar
                  className="size-12"
                  useLottie={true}
                />
                <div className="text-white">
                  <div className="font-semibold">John Doe</div>
                  <div className="text-sm text-slate-300">john@example.com</div>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <LottieAvatar
                  className="size-10"
                  useLottie={true}
                />
                <div className="text-white">
                  <div className="font-semibold">Jane Smith</div>
                  <div className="text-sm text-slate-300">jane@example.com</div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <LottieAvatar
                  className="size-8"
                  useLottie={true}
                />
                <div className="text-white">
                  <div className="font-semibold">Mike Johnson</div>
                  <div className="text-sm text-slate-300">mike@example.com</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Hover Avatar */}
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle className="text-white">Hover-Enhanced Avatar</CardTitle>
              <CardDescription className="text-slate-300">
                Shows Lottie animation on hover (hover over the avatars!)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <EnhancedLottieAvatar
                  className="size-12 transition-transform hover:scale-110"
                  src="/pf.png"
                  alt="User 1"
                  fallbackText="U1"
                  showLottieOnHover={true}
                />
                <div className="text-white">
                  <div className="font-semibold">User with Image</div>
                  <div className="text-sm text-slate-300">Hover to see animation</div>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <EnhancedLottieAvatar
                  className="size-10 transition-transform hover:scale-110"
                  alt="User 2"
                  fallbackText="U2"
                  showLottieOnHover={true}
                />
                <div className="text-white">
                  <div className="font-semibold">User without Image</div>
                  <div className="text-sm text-slate-300">Always shows animation</div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <EnhancedLottieAvatar
                  className="size-8 transition-transform hover:scale-110"
                  src=""
                  alt="User 3"
                  fallbackText="U3"
                  showLottieOnHover={true}
                />
                <div className="text-white">
                  <div className="font-semibold">User with empty image</div>
                  <div className="text-sm text-slate-300">Always shows animation</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Different Sizes */}
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle className="text-white">Different Sizes</CardTitle>
              <CardDescription className="text-slate-300">
                Animated avatars scale beautifully at any size
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6 flex-wrap">
                <div className="text-center">
                  <LottieAvatar className="size-6" useLottie={true} />
                  <div className="text-xs text-slate-300 mt-2">6x6</div>
                </div>
                <div className="text-center">
                  <LottieAvatar className="size-8" useLottie={true} />
                  <div className="text-xs text-slate-300 mt-2">8x8</div>
                </div>
                <div className="text-center">
                  <LottieAvatar className="size-12" useLottie={true} />
                  <div className="text-xs text-slate-300 mt-2">12x12</div>
                </div>
                <div className="text-center">
                  <LottieAvatar className="size-16" useLottie={true} />
                  <div className="text-xs text-slate-300 mt-2">16x16</div>
                </div>
                <div className="text-center">
                  <LottieAvatar className="size-20" useLottie={true} />
                  <div className="text-xs text-slate-300 mt-2">20x20</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Code Example */}
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle className="text-white">Usage Examples</CardTitle>
              <CardDescription className="text-slate-300">
                How to use the animated avatars in your code
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-slate-900/50 rounded-lg p-4">
                <pre className="text-sm text-slate-300 overflow-x-auto">
                  <code>{`// Basic animated avatar
<LottieAvatar 
  className="size-12" 
  useLottie={true} 
/>

// With user image fallback
<LottieAvatar 
  className="size-12"
  src={user?.image}
  alt={user?.name}
  fallbackText={user?.name?.[0]}
  useLottie={!user?.image}
/>

// Hover-enhanced version
<EnhancedLottieAvatar
  className="size-12"
  src={user?.image}
  showLottieOnHover={true}
/>`}</code>
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-12 text-center">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
            <h3 className="text-white text-lg font-semibold mb-4">✨ Features</h3>
            <div className="text-slate-300 text-sm space-y-2 max-w-2xl mx-auto">
              <p>🎭 <strong>Animated fallback:</strong> Beautiful Lottie animation when no user image</p>
              <p>🖱️ <strong>Hover effects:</strong> Interactive animations on user interaction</p>
              <p>📏 <strong>Responsive sizing:</strong> Scales perfectly at any size</p>
              <p>⚡ <strong>Performance optimized:</strong> Smooth animations with minimal overhead</p>
              <p>🎨 <strong>Customizable:</strong> Easy to theme and style</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}