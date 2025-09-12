"use client";

import { useState } from "react";
import { LottieIcon } from "./lottie-animation";
import { Card, CardContent, CardHeader, CardTitle } from "./card";

interface IconCategory {
  title: string;
  description: string;
  icons: {
    name: string;
    icon: string;
    loop?: boolean;
    description: string;
  }[];
}

const iconCategories: IconCategory[] = [
  {
    title: "Status & Feedback",
    description: "Icons for user feedback and status indication",
    icons: [
      { name: "Success", icon: "checkmark", loop: false, description: "Confirmation & success states" },
      { name: "Error", icon: "cancel", loop: false, description: "Error & cancellation states" },
      { name: "Warning", icon: "alert-triangle", loop: false, description: "Warning & caution states" },
      { name: "Info", icon: "alert-circle", loop: false, description: "Information & help states" },
    ]
  },
  {
    title: "Actions & Navigation", 
    description: "Interactive icons for user actions",
    icons: [
      { name: "Settings", icon: "settings", loop: true, description: "Configuration & preferences" },
      { name: "Search", icon: "search", loop: true, description: "Search & discovery" },
      { name: "Menu", icon: "menu-hamburger", loop: false, description: "Navigation menus" },
      { name: "Download", icon: "download", loop: false, description: "File downloads" },
      { name: "Upload", icon: "upload", loop: false, description: "File uploads" },
    ]
  },
  {
    title: "Social & Engagement",
    description: "Icons for user interaction and engagement", 
    icons: [
      { name: "Heart", icon: "heart", loop: true, description: "Likes & favorites" },
      { name: "Comments", icon: "comment", loop: false, description: "Comments & discussions" },
      { name: "Notifications", icon: "notification-bell", loop: false, description: "Alerts & notifications" },
      { name: "User Profile", icon: "user-profile", loop: true, description: "User avatars & profiles" },
    ]
  }
];

export function LottieIconShowcase() {
  const [activeCategory, setActiveCategory] = useState(0);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">🎨 Lottie Icon Library</h1>
        <p className="text-muted-foreground">
          Interactive, animated icons for modern UI experiences
        </p>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap justify-center gap-2 mb-8">
        {iconCategories.map((category, index) => (
          <button
            key={index}
            onClick={() => setActiveCategory(index)}
            className={`px-4 py-2 rounded-lg transition-all ${
              activeCategory === index
                ? "bg-primary text-primary-foreground shadow-lg"
                : "bg-muted hover:bg-muted/80 text-muted-foreground"
            }`}
          >
            {category.title}
          </button>
        ))}
      </div>

      {/* Active Category Display */}
      <Card className="mb-8">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{iconCategories[activeCategory].title}</CardTitle>
          <p className="text-muted-foreground">{iconCategories[activeCategory].description}</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {iconCategories[activeCategory].icons.map((iconData, index) => (
              <div 
                key={index}
                className="flex flex-col items-center p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer group"
              >
                <div className="mb-3 p-3 rounded-full bg-background border group-hover:shadow-lg transition-shadow">
                  <LottieIcon
                    icon={iconData.icon as any}
                    size="md"
                    loop={iconData.loop}
                    autoplay={true}
                  />
                </div>
                <h4 className="font-semibold text-sm mb-1">{iconData.name}</h4>
                <p className="text-xs text-muted-foreground text-center">
                  {iconData.description}
                </p>
                <code className="text-xs bg-muted px-2 py-1 rounded mt-2">
                  icon="{iconData.icon}"
                </code>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Usage Example */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Example</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/50 rounded-lg p-4">
            <pre className="text-sm overflow-x-auto">
              <code>{`import { LottieIcon } from "@/components/ui/lottie-animation";

// Basic usage
<LottieIcon 
  icon="${iconCategories[activeCategory].icons[0]?.icon || 'checkmark'}" 
  size="md" 
  loop={${iconCategories[activeCategory].icons[0]?.loop || false}}
  autoplay={true}
/>

// With custom styling
<LottieIcon 
  icon="${iconCategories[activeCategory].icons[0]?.icon || 'checkmark'}"
  size="lg"
  className="text-blue-500"
  loop={false}
  autoplay={true}
/>`}</code>
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="mt-8 text-center">
        <div className="inline-flex items-center gap-8 bg-muted/50 rounded-lg p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">
              {iconCategories.reduce((total, cat) => total + cat.icons.length, 0)}
            </div>
            <div className="text-xs text-muted-foreground">Total Icons</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{iconCategories.length}</div>
            <div className="text-xs text-muted-foreground">Categories</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">∞</div>
            <div className="text-xs text-muted-foreground">Possibilities</div>
          </div>
        </div>
      </div>
    </div>
  );
}