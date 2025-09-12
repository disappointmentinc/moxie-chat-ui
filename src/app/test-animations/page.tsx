"use client";

import { useState } from "react";
import { LottieAnimation } from "@/components/ui/lottie-animation";

export default function TestAnimationsPage() {
  const [showAnimations, setShowAnimations] = useState(true);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            🎬 Lottie Animations Test
          </h1>
          <p className="text-slate-300 mb-6">
            Click the button to toggle animations and see them in action!
          </p>
          <button
            onClick={() => setShowAnimations(!showAnimations)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            {showAnimations ? "Hide Animations" : "Show Animations"}
          </button>
        </div>

        {showAnimations && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Loading Animations */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center">
              <h3 className="text-white text-lg font-semibold mb-4">
                Loading Animations
              </h3>
              <div className="space-y-4">
                <div>
                  <LottieAnimation
                    animationPath="/animations/loaders/loader-01.json"
                    size="md"
                    loop={true}
                    autoplay={true}
                  />
                  <p className="text-slate-300 text-sm mt-2">Loader 01</p>
                </div>
                <div>
                  <LottieAnimation
                    animationPath="/animations/loaders/loader-05.json"
                    size="md"
                    loop={true}
                    autoplay={true}
                  />
                  <p className="text-slate-300 text-sm mt-2">Loader 05</p>
                </div>
              </div>
            </div>

            {/* UI Icons - Original Set */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center">
              <h3 className="text-white text-lg font-semibold mb-4">
                UI Icons - Status
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <LottieAnimation
                    animationPath="/animations/ui-icons/checkmark-circle.json"
                    size="sm"
                    loop={false}
                    autoplay={true}
                  />
                  <p className="text-slate-300 text-xs mt-1">Success</p>
                </div>
                <div>
                  <LottieAnimation
                    animationPath="/animations/ui-icons/cancel-circle.json"
                    size="sm"
                    loop={false}
                    autoplay={true}
                  />
                  <p className="text-slate-300 text-xs mt-1">Cancel</p>
                </div>
                <div>
                  <LottieAnimation
                    animationPath="/animations/ui-icons/alert-triangle.json"
                    size="sm"
                    loop={false}
                    autoplay={true}
                  />
                  <p className="text-slate-300 text-xs mt-1">Warning</p>
                </div>
                <div>
                  <LottieAnimation
                    animationPath="/animations/ui-icons/settings-gear.json"
                    size="sm"
                    loop={true}
                    autoplay={true}
                  />
                  <p className="text-slate-300 text-xs mt-1">Settings</p>
                </div>
              </div>
            </div>

            {/* UI Icons - New Set */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center">
              <h3 className="text-white text-lg font-semibold mb-4">
                UI Icons - Interactive
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <LottieAnimation
                    animationPath="/animations/ui-icons/heart.json"
                    size="sm"
                    loop={true}
                    autoplay={true}
                  />
                  <p className="text-slate-300 text-xs mt-1">Heart/Like</p>
                </div>
                <div>
                  <LottieAnimation
                    animationPath="/animations/ui-icons/search.json"
                    size="sm"
                    loop={true}
                    autoplay={true}
                  />
                  <p className="text-slate-300 text-xs mt-1">Search</p>
                </div>
                <div>
                  <LottieAnimation
                    animationPath="/animations/ui-icons/notification-bell.json"
                    size="sm"
                    loop={false}
                    autoplay={true}
                  />
                  <p className="text-slate-300 text-xs mt-1">Notifications</p>
                </div>
                <div>
                  <LottieAnimation
                    animationPath="/animations/ui-icons/menu-hamburger.json"
                    size="sm"
                    loop={false}
                    autoplay={true}
                  />
                  <p className="text-slate-300 text-xs mt-1">Menu</p>
                </div>
                <div>
                  <LottieAnimation
                    animationPath="/animations/ui-icons/user-profile.json"
                    size="sm"
                    loop={true}
                    autoplay={true}
                  />
                  <p className="text-slate-300 text-xs mt-1">User Profile</p>
                </div>
              </div>
            </div>

            {/* Marketing Animations */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center">
              <h3 className="text-white text-lg font-semibold mb-4">
                Marketing
              </h3>
              <div className="space-y-4">
                <div>
                  <LottieAnimation
                    animationPath="/animations/marketing/ideas.json"
                    size="lg"
                    loop={true}
                    autoplay={true}
                    speed={0.7}
                  />
                  <p className="text-slate-300 text-sm mt-2">Ideas</p>
                </div>
              </div>
            </div>

            {/* Data Visualization */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center md:col-span-2 lg:col-span-3">
              <h3 className="text-white text-lg font-semibold mb-4">
                Data Visualization
              </h3>
              <div className="flex justify-center">
                <LottieAnimation
                  animationPath="/animations/data-viz/data-viz-dark.json"
                  size="xl"
                  loop={true}
                  autoplay={true}
                  speed={0.8}
                />
              </div>
              <p className="text-slate-300 text-sm mt-2">
                Data Visualization (Dark)
              </p>
            </div>
          </div>
        )}

        <div className="mt-12 text-center">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
            <h3 className="text-white text-lg font-semibold mb-4">
              What You Should See:
            </h3>
            <div className="text-slate-300 text-sm space-y-2 max-w-2xl mx-auto">
              <p>
                ✅ <strong>Loading animations</strong> - Smooth, abstract
                loading spinners
              </p>
              <p>
                ✅ <strong>UI icons</strong> - Interactive checkmarks, alerts,
                and settings
              </p>
              <p>
                ✅ <strong>Marketing animations</strong> - Creative ideas and
                growth concepts
              </p>
              <p>
                ✅ <strong>Data visualization</strong> - Complex animated charts
                and graphs
              </p>
              <p className="mt-4 text-blue-300">
                🎯 <strong>If you don&apos;t see animations:</strong> Check
                browser dev tools console for errors
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
