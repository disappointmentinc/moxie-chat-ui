"use client";

import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenu,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
  DropdownMenuCheckboxItem,
} from "ui/dropdown-menu";
import { SidebarMenuButton, SidebarMenuItem, SidebarMenu } from "ui/sidebar";
import {
  ChevronsUpDown,
  Command,
  LogOutIcon,
  Settings2,
  Palette,
  Languages,
  Sun,
  MoonStar,
  ChevronRight,
  Settings,
  Smartphone,
} from "lucide-react";
import { useTheme } from "next-themes";
import { appStore } from "@/app/store";
import { BASE_THEMES, COOKIE_KEY_LOCALE, SUPPORTED_LOCALES } from "lib/const";
import { capitalizeFirstLetter, cn, fetcher } from "lib/utils";
import { authClient } from "auth/client";
import { useTranslations } from "next-intl";
import useSWR from "swr";
import { getLocaleAction } from "@/i18n/get-locale";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useThemeStyle } from "@/hooks/use-theme-style";
import { BasicUser } from "app-types/user";
import { getUserAvatar } from "lib/user/utils";
import { Skeleton } from "ui/skeleton";
import { LottieAvatar } from "@/components/ui/lottie-avatar";
import { toast } from "sonner";

export function AppSidebarUserInner(props: {
  user?: BasicUser;
}) {
  const { data: user } = useSWR<BasicUser>(`/api/user/details`, fetcher, {
    fallbackData: props.user,
    suspense: true,
    revalidateOnMount: false,
    revalidateOnFocus: false,
    shouldRetryOnError: false,
    refreshInterval: 1000 * 60 * 10,
  });
  const appStoreMutate = appStore((state) => state.mutate);
  const t = useTranslations("Layout");
  const { theme, setTheme } = useTheme();
  const { themeStyle, setThemeStyle } = useThemeStyle();
  const [canInstallPWA, setCanInstallPWA] = useState(false);

  const logout = () => {
    authClient.signOut().finally(() => {
      window.location.href = "/sign-in";
    });
  };

  // Keep the session fresh while sidebar is mounted
  useSWR(
    "/session-update",
    () =>
      authClient.getSession().then(() => {
        console.debug(`session-update: ${new Date().toISOString()}`);
      }),
    {
      refreshIntervalOnFocus: false,
      focusThrottleInterval: 1000 * 60 * 5,
      revalidateOnFocus: false,
      refreshWhenHidden: true,
      refreshInterval: 1000 * 60 * 5,
    },
  );

  // Check if PWA can be installed
  useEffect(() => {
    const checkPWAInstallability = () => {
      if (typeof window !== "undefined" && (window as any).pwaManager) {
        setCanInstallPWA(Boolean((window as any).pwaManager.canInstall));
      }
    };

    checkPWAInstallability();
    const interval = setInterval(checkPWAInstallability, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleInstallPWA = useCallback(async () => {
    if (typeof window !== "undefined" && (window as any).pwaManager) {
      try {
        await (window as any).pwaManager.installApp();
      } catch (error) {
        console.error("Failed to install PWA:", error);
        toast.error("Failed to install app");
      }
    } else {
      toast.info(
        "Install not available. Visit this site on mobile Chrome/Safari or desktop Chrome/Edge",
      );
    }
  }, []);

  const userAvatar = useMemo(() => user ? getUserAvatar(user) : "/pf.png", [user]);
  const shouldUseLottie = !user?.image || userAvatar === "/profile-avatar.png";

  if (!user) return null;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground bg-input/30 border"
              size={"lg"}
              data-testid="sidebar-user-button"
            >
              <LottieAvatar
                className="rounded-full size-8 border"
                src={userAvatar}
                alt={user?.name || "User"}
                fallbackText={user?.name?.slice(0, 1) || ""}
                useLottie={shouldUseLottie}
              />
              <span className="truncate" data-testid="sidebar-user-email">
                {user?.email}
              </span>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            className="bg-background w-[--radix-dropdown-menu-trigger-width] min-w-60 rounded-lg"
            align="center"
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <LottieAvatar
                  className="h-8 w-8 rounded-full"
                  src={userAvatar}
                  alt={user?.name || "User"}
                  fallbackText={user?.name?.slice(0, 1) || ""}
                  useLottie={shouldUseLottie}
                />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span
                    className="truncate font-medium"
                    data-testid="sidebar-user-name"
                  >
                    {user?.name}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user?.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => appStoreMutate({ openChatPreferences: true })}
            >
              <Settings2 className="size-4 text-foreground" />
              <span>{t("chatPreferences")}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => appStoreMutate({ openShortcutsPopup: true })}
            >
              <Command className="size-4 text-foreground" />
              <span>{t("keyboardShortcuts")}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />

            {(canInstallPWA || typeof window === "undefined") && (
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={handleInstallPWA}
              >
                <Smartphone className="size-4 text-foreground" />
                <span>Install to Phone</span>
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={() => appStoreMutate({ openUserSettings: true })}
              className="cursor-pointer"
              data-testid="user-settings-menu-item"
            >
              <Settings className="size-4 text-foreground" />
              <span>User Settings</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <SelectTheme
              theme={theme}
              setTheme={setTheme}
              themeStyle={themeStyle}
              setThemeStyle={setThemeStyle}
            />
            <SelectLanguage />

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={logout} className="cursor-pointer">
              <LogOutIcon className="size-4 text-foreground" />
              <span>{t("logout")}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function SelectTheme({
  theme,
  setTheme,
  themeStyle,
  setThemeStyle,
}: {
  theme?: string;
  setTheme: (theme: string) => void;
  themeStyle: string;
  setThemeStyle: (theme: string) => void;
}) {
  const t = useTranslations("Layout");

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger
        className="cursor-pointer"
        data-testid="theme-menu-trigger"
      >
        <Palette className="mr-2 size-4" />
        <span className="mr-auto">{t("theme")}</span>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          {capitalizeFirstLetter(themeStyle)}
          <ChevronRight className="size-4 ml-2" />
        </span>
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent className="w-48">
          <DropdownMenuLabel className="text-muted-foreground w-full flex items-center">
            <span className="text-muted-foreground text-xs mr-2 select-none">
              {capitalizeFirstLetter(theme ?? "light")}
            </span>
            <div className="flex-1" />

            <div
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              className="cursor-pointer border rounded-full flex items-center"
            >
              <div
                className={cn(
                  theme === "dark" &&
                    "bg-accent ring ring-muted-foreground/40 text-foreground",
                  "p-1 rounded-full",
                )}
              >
                <MoonStar className="size-3" />
              </div>
              <div
                className={cn(
                  theme === "light" &&
                    "bg-accent ring ring-muted-foreground/40 text-foreground",
                  "p-1 rounded-full",
                )}
              >
                <Sun className="size-3" />
              </div>
            </div>
          </DropdownMenuLabel>
          <div className="max-h-96 overflow-y-auto">
            {BASE_THEMES.map((themeName) => (
              <DropdownMenuCheckboxItem
                key={themeName}
                checked={themeStyle === themeName}
                onClick={(event) => {
                  event.preventDefault();
                  setThemeStyle(themeName);
                }}
                className="text-sm"
              >
                {capitalizeFirstLetter(themeName)}
              </DropdownMenuCheckboxItem>
            ))}
          </div>
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
}

function SelectLanguage() {
  const t = useTranslations("Layout");
  const { data: currentLocale } = useSWR(COOKIE_KEY_LOCALE, getLocaleAction, {
    fallbackData: SUPPORTED_LOCALES[0].code,
    revalidateOnFocus: false,
  });
  const handleOnChange = useCallback((locale: string) => {
    document.cookie = `${COOKIE_KEY_LOCALE}=${locale}; path=/;`;
    window.location.reload();
  }, []);

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="cursor-pointer">
        <Languages className="mr-2 size-4" />
        <span>{t("language")}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent className="w-48 max-h-96 overflow-y-auto">
          <DropdownMenuLabel className="text-muted-foreground">
            {t("language")}
          </DropdownMenuLabel>
          {SUPPORTED_LOCALES.map((locale) => (
            <DropdownMenuCheckboxItem
              key={locale.code}
              checked={locale.code === currentLocale}
              onCheckedChange={() =>
                locale.code !== currentLocale && handleOnChange(locale.code)
              }
            >
              {locale.name}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
}

export function AppSidebarUserSkeleton() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground bg-input/30 border"
          size={"lg"}
          data-testid="sidebar-user-button"
        >
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 w-24" />
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export function AppSidebarUser({
  user,
}: {
  user?: BasicUser;
}) {
  return (
    <Suspense fallback={<AppSidebarUserSkeleton />}>
      <AppSidebarUserInner user={user} />
    </Suspense>
  );
}
