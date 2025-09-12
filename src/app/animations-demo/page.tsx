"use client";

import { LottieAnimation, LottieIcon } from "@/components/ui/lottie-animation";
import { LottieAvatar, EnhancedLottieAvatar } from "@/components/ui/lottie-avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AnimationsDemoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-6">
            🎬 Lottie Animations Showcase
          </h1>
          <p className="text-slate-300 text-xl mb-4">
            Beautiful animated UI elements powered by Lottie
          </p>
          <p className="text-slate-400 text-sm">
            This page demonstrates all the Lottie animations integrated into the UX
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          
          {/* Loading Animations */}
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                🔄 Loading Animations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center">
                <LottieAnimation
                  animationPath="/animations/loaders/loader-01.json"
                  size="lg"
                  loop={true}
                  autoplay={true}
                />
                <p className="text-slate-300 text-sm mt-2">Loader 01</p>
              </div>
              <div className="text-center">
                <LottieAnimation
                  animationPath="/animations/loaders/loader-05.json"
                  size="lg"
                  loop={true}
                  autoplay={true}
                />
                <p className="text-slate-300 text-sm mt-2">Loader 05</p>
              </div>
            </CardContent>
          </Card>

          {/* UI Icons */}
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                ⭐ UI Icons
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <LottieIcon icon="checkmark" size="md" loop={false} autoplay={true} />
                  <p className="text-slate-300 text-xs mt-1">Success</p>
                </div>
                <div className="text-center">
                  <LottieIcon icon="cancel" size="md" loop={false} autoplay={true} />
                  <p className="text-slate-300 text-xs mt-1">Cancel</p>
                </div>
                <div className="text-center">
                  <LottieIcon icon="alert-triangle" size="md" loop={false} autoplay={true} />
                  <p className="text-slate-300 text-xs mt-1">Warning</p>
                </div>
                <div className="text-center">
                  <LottieIcon icon="settings" size="md" loop={true} autoplay={true} />
                  <p className="text-slate-300 text-xs mt-1">Settings</p>
                </div>
                <div className="text-center">
                  <LottieIcon icon="heart" size="md" loop={true} autoplay={true} />
                  <p className="text-slate-300 text-xs mt-1">Heart</p>
                </div>
                <div className="text-center">
                  <LottieIcon icon="search" size="md" loop={true} autoplay={true} />
                  <p className="text-slate-300 text-xs mt-1">Search</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Avatar Examples */}
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                👤 Animated Avatars
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <LottieAvatar
                  className="size-12"
                  useLottie={true}
                />
                <div className="text-white">
                  <div className="font-semibold">Animated User</div>
                  <div className="text-xs text-slate-300">Always shows animation</div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <EnhancedLottieAvatar
                  className="size-12 transition-transform hover:scale-110"
                  src="/pf.png"
                  showLottieOnHover={true}
                />
                <div className="text-white">
                  <div className="font-semibold">Hover Avatar</div>
                  <div className="text-xs text-slate-300">Hover to see animation</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Communication Icons */}
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                💬 Communication
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <LottieIcon icon="notification-bell" size="md" loop={false} autoplay={true} />
                  <p className="text-slate-300 text-xs mt-1">Notifications</p>
                </div>
                <div className="text-center">
                  <LottieIcon icon="comment" size="md" loop={false} autoplay={true} />
                  <p className="text-slate-300 text-xs mt-1">Comments</p>
                </div>
                <div className="text-center">
                  <LottieIcon icon="menu-hamburger" size="md" loop={false} autoplay={true} />
                  <p className="text-slate-300 text-xs mt-1">Menu</p>
                </div>
                <div className="text-center">
                  <LottieIcon icon="user-profile" size="md" loop={true} autoplay={true} />
                  <p className="text-slate-300 text-xs mt-1">Profile</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Marketing Animation */}
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                💡 Marketing
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <LottieAnimation
                animationPath="/animations/marketing/ideas.json"
                size="xl"
                loop={true}
                autoplay={true}
                speed={0.7}
              />
              <p className="text-slate-300 text-sm mt-2">Creative Ideas</p>
            </CardContent>
          </Card>

          {/* Data Visualization */}
          <Card className="bg-white/10 backdrop-blur-sm border-white/20 md:col-span-2 lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                📊 Data Visualization
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <LottieAnimation
                animationPath="/animations/data-viz/data-viz-dark.json"
                size="xl"
                loop={true}
                autoplay={true}
                speed={0.8}
              />
              <p className="text-slate-300 text-sm mt-2">Animated Charts</p>
            </CardContent>
          </Card>
        </div>

        {/* Features Summary */}
        <div className="mt-16 text-center">
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardContent className="p-8">
              <h3 className="text-white text-2xl font-semibold mb-6">✨ Animation Features</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-slate-300">
                <div>
                  <div className="text-3xl mb-2">🎭</div>
                  <div className="font-semibold">Smart Fallbacks</div>
                  <div className="text-sm">Animations when no image available</div>
                </div>
                <div>
                  <div className="text-3xl mb-2">🖱️</div>
                  <div className="font-semibold">Interactive</div>
                  <div className="text-sm">Hover effects and user interactions</div>
                </div>
                <div>
                  <div className="text-3xl mb-2">📏</div>
                  <div className="font-semibold">Responsive</div>
                  <div className="text-sm">Scales perfectly at any size</div>
                </div>
                <div>
                  <div className="text-3xl mb-2">⚡</div>
                  <div className="font-semibold">Optimized</div>
                  <div className="text-sm">Smooth performance</div>
                </div>
              </div>
              
              <div className="mt-8 p-4 bg-blue-600/20 rounded-lg">
                <p className="text-blue-200 text-sm">
                  🎯 <strong>All animations are now integrated throughout your UX!</strong> 
                  Visit the main application to see them in loading states, notifications, user avatars, and more.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}