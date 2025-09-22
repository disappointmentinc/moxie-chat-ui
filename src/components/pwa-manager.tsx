"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

export const PWAManager = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(
    null,
  );
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      setIsSupported(true);
      registerServiceWorker();

      // Listen for PWA install prompt
      const handleBeforeInstallPrompt = (e: any) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setShowInstallPrompt(true);
      };

      const handleAppInstalled = () => {
        setDeferredPrompt(null);
        setShowInstallPrompt(false);
        toast.success("App installed successfully!");
      };

      window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.addEventListener("appinstalled", handleAppInstalled);

      return () => {
        window.removeEventListener(
          "beforeinstallprompt",
          handleBeforeInstallPrompt,
        );
        window.removeEventListener("appinstalled", handleAppInstalled);
      };
    }
  }, []);

  const registerServiceWorker = async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      console.log("Service Worker registered:", registration);

      // Check for existing subscription
      const existingSubscription =
        await registration.pushManager.getSubscription();
      setSubscription(existingSubscription);
    } catch (error) {
      console.error("Service Worker registration failed:", error);
    }
  };

  const requestNotificationPermission = async () => {
    if (!isSupported || !("Notification" in window)) {
      toast.error("Notifications not supported in this browser");
      return false;
    }

    const permission = await Notification.requestPermission();

    if (permission === "granted") {
      toast.success("Notifications enabled successfully!");
      await subscribeToNotifications();
      return true;
    } else if (permission === "denied") {
      toast.error("Notifications blocked. Please enable in browser settings.");
      return false;
    } else {
      toast.warning("Notification permission dismissed");
      return false;
    }
  };

  const subscribeToNotifications = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;

      // Generate VAPID keys in production - this is a dummy key for development
      const vapidPublicKey =
        "BEl62iUYgUivxIkv69yViEuiBIa40HI0DLWQkGjR4QJn4rR8zLB2HNE2RaQ1wGKAGnGNlc_BcLnF3PKm0F9gZo8";

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidPublicKey,
      });

      setSubscription(subscription);

      // Send subscription to server
      await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      });

      console.log("Push subscription sent to server");
    } catch (error) {
      console.error("Failed to subscribe to notifications:", error);
      toast.error("Failed to subscribe to notifications");
    }
  };

  const unsubscribeFromNotifications = async () => {
    if (subscription) {
      try {
        // Notify server about unsubscription
        await fetch("/api/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });

        await subscription.unsubscribe();
        setSubscription(null);
        toast.success("Unsubscribed from notifications");
      } catch (error) {
        console.error("Failed to unsubscribe:", error);
        toast.error("Failed to unsubscribe from notifications");
      }
    }
  };

  const sendTestNotification = () => {
    if (Notification.permission === "granted") {
      new Notification("Moxie Chat Test", {
        body: "This is a test notification from Moxie Chat!",
        icon: "/favicon.png",
        badge: "/favicon.png",
      });
    } else {
      toast.error("Notifications not enabled");
    }
  };

  const installApp = async () => {
    if (deferredPrompt) {
      try {
        const result = await deferredPrompt.prompt();
        console.log("PWA install prompt result:", result.outcome);

        if (result.outcome === "accepted") {
          toast.success("Installing app...");
        } else {
          toast.info("App installation cancelled");
        }

        setDeferredPrompt(null);
        setShowInstallPrompt(false);
      } catch (error) {
        console.error("Error showing install prompt:", error);
        toast.error("Failed to install app");
      }
    } else {
      toast.info("App install not available or already installed");
    }
  };

  const dismissInstallPrompt = () => {
    setShowInstallPrompt(false);
    setDeferredPrompt(null);
  };

  // Expose functions globally for easy access
  if (typeof window !== "undefined") {
    (window as any).pwaManager = {
      requestNotificationPermission,
      sendTestNotification,
      unsubscribeFromNotifications,
      installApp,
      dismissInstallPrompt,
      isSupported,
      subscription: !!subscription,
      canInstall: !!deferredPrompt,
      showInstallPrompt,
    };
  }

  return null; // This component doesn't render anything
};

export default PWAManager;
