"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { LottieLoader, LottieIcon, LottieAnimation } from "./lottie-animation";
import { LottieNotification } from "./lottie-notification";
import { LottieEmptyState } from "./lottie-empty-state";
import { Button } from "./button";
import { useState } from "react";

export function LottieShowcase() {
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Lottie Animation Showcase</h1>
        <p className="text-muted-foreground">
          Beautiful animations integrated throughout Healthrise Velocity
        </p>
      </div>

      {/* Loading States */}
      <Card>
        <CardHeader>
          <CardTitle>Loading Animations</CardTitle>
          <CardDescription>
            Smooth loading indicators for better user experience
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-8 items-center">
          <div className="text-center">
            <LottieLoader variant="01" size="md" />
            <p className="text-sm text-muted-foreground mt-2">Loader 01</p>
          </div>
          <div className="text-center">
            <LottieLoader variant="05" size="md" />
            <p className="text-sm text-muted-foreground mt-2">Loader 05</p>
          </div>
          <div className="text-center">
            <LottieLoader variant="10" size="md" />
            <p className="text-sm text-muted-foreground mt-2">Loader 10</p>
          </div>
        </CardContent>
      </Card>

      {/* UI Icons */}
      <Card>
        <CardHeader>
          <CardTitle>Interactive Icons</CardTitle>
          <CardDescription>
            Animated icons that bring life to interactions
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-8 items-center">
          <div className="text-center">
            <LottieIcon icon="checkmark" size="md" loop={false} autoplay={true} />
            <p className="text-sm text-muted-foreground mt-2">Success</p>
          </div>
          <div className="text-center">
            <LottieIcon icon="cancel" size="md" loop={false} autoplay={true} />
            <p className="text-sm text-muted-foreground mt-2">Cancel</p>
          </div>
          <div className="text-center">
            <LottieIcon icon="alert-triangle" size="md" loop={false} autoplay={true} />
            <p className="text-sm text-muted-foreground mt-2">Warning</p>
          </div>
          <div className="text-center">
            <LottieIcon icon="settings" size="md" loop={true} autoplay={true} />
            <p className="text-sm text-muted-foreground mt-2">Settings</p>
          </div>
          <div className="text-center">
            <LottieIcon icon="download" size="md" loop={false} autoplay={true} />
            <p className="text-sm text-muted-foreground mt-2">Download</p>
          </div>
          <div className="text-center">
            <LottieIcon icon="upload" size="md" loop={false} autoplay={true} />
            <p className="text-sm text-muted-foreground mt-2">Upload</p>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Notification States</CardTitle>
          <CardDescription>
            Rich notifications with contextual animations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={() => setShowNotifications(!showNotifications)}>
            {showNotifications ? 'Hide' : 'Show'} Notifications
          </Button>
          {showNotifications && (
            <div className="space-y-4">
              <LottieNotification
                type="success"
                title="Success!"
                description="Your action was completed successfully."
              />
              <LottieNotification
                type="error"
                title="Error occurred"
                description="Something went wrong. Please try again."
              />
              <LottieNotification
                type="warning"
                title="Warning"
                description="Please review your input before proceeding."
              />
              <LottieNotification
                type="info"
                title="Information"
                description="Here's some important information to note."
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Empty States */}
      <Card>
        <CardHeader>
          <CardTitle>Empty States</CardTitle>
          <CardDescription>
            Engaging animations for when content is not available
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-8">
            <LottieEmptyState
              title="No ideas yet"
              description="Start brainstorming to see your ideas come to life."
              animationType="ideas"
              className="border rounded-lg"
            />
            <LottieEmptyState
              title="Ready to grow"
              description="Your growth journey starts here."
              animationType="growth"
              className="border rounded-lg"
            />
          </div>
        </CardContent>
      </Card>

      {/* Data Visualization */}
      <Card>
        <CardHeader>
          <CardTitle>Data Visualization</CardTitle>
          <CardDescription>
            Beautiful animations for data-rich interfaces
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <div className="text-center">
            <LottieAnimation
              animationPath="/animations/data-viz/data-viz-dark.json"
              size="xl"
              loop={true}
              autoplay={true}
              speed={0.8}
            />
            <p className="text-sm text-muted-foreground mt-2">Data Visualization</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}