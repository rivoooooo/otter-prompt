import { useEffect } from "react"

import "@workspace/ui/globals.css"
import "./app-theme.css"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import {
  APP_SETTINGS_STORAGE_KEY,
  APP_SETTINGS_UPDATED_EVENT,
  getAppSettings,
  type ThemeMode,
} from "./lib/app-settings"
import { syncRuntimeSettings } from "./lib/runtime-settings-sync"

const THEME_MEDIA_QUERY = "(prefers-color-scheme: dark)"

function resolveIsDark(
  themeMode: ThemeMode,
  mediaQueryList?: MediaQueryList | null
) {
  if (themeMode === "dark") {
    return true
  }

  if (themeMode === "light") {
    return false
  }

  return mediaQueryList?.matches ?? false
}

export function applyTheme(
  themeMode: ThemeMode,
  mediaQueryList?: MediaQueryList | null
) {
  if (typeof document === "undefined") {
    return
  }

  const isDark = resolveIsDark(
    themeMode,
    mediaQueryList ??
      (typeof window !== "undefined"
        ? window.matchMedia(THEME_MEDIA_QUERY)
        : null)
  )
  const root = document.documentElement

  root.classList.toggle("dark", isDark)
  root.style.colorScheme = isDark ? "dark" : "light"
  root.dataset.themeMode = themeMode
}

export const themeInitScript = `(() => {
  const storageKey = ${JSON.stringify(APP_SETTINGS_STORAGE_KEY)}
  const mediaQuery = ${JSON.stringify(THEME_MEDIA_QUERY)}

  try {
    const raw = window.localStorage.getItem(storageKey)
    const parsed = raw ? JSON.parse(raw) : null
    const themeMode =
      parsed?.general?.themeMode === "light" ||
      parsed?.general?.themeMode === "dark"
        ? parsed.general.themeMode
        : "system"
    const isDark =
      themeMode === "dark" ||
      (themeMode === "system" &&
        window.matchMedia(mediaQuery).matches)
    const root = document.documentElement

    root.classList.toggle("dark", isDark)
    root.style.colorScheme = isDark ? "dark" : "light"
    root.dataset.themeMode = themeMode
  } catch {
    const isDark = window.matchMedia(mediaQuery).matches
    const root = document.documentElement

    root.classList.toggle("dark", isDark)
    root.style.colorScheme = isDark ? "dark" : "light"
    root.dataset.themeMode = "system"
  }
})()`

function ThemeController() {
  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const mediaQueryList = window.matchMedia(THEME_MEDIA_QUERY)
    const syncTheme = () =>
      applyTheme(getAppSettings().general.themeMode, mediaQueryList)
    const handleSettingsUpdated = () => syncTheme()
    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== APP_SETTINGS_STORAGE_KEY) {
        return
      }

      syncTheme()
    }
    const handleMediaChange = () => {
      if (getAppSettings().general.themeMode === "system") {
        syncTheme()
      }
    }

    syncTheme()
    window.addEventListener(APP_SETTINGS_UPDATED_EVENT, handleSettingsUpdated)
    window.addEventListener("storage", handleStorage)

    if (typeof mediaQueryList.addEventListener === "function") {
      mediaQueryList.addEventListener("change", handleMediaChange)
    } else {
      mediaQueryList.addListener(handleMediaChange)
    }

    return () => {
      window.removeEventListener(
        APP_SETTINGS_UPDATED_EVENT,
        handleSettingsUpdated
      )
      window.removeEventListener("storage", handleStorage)

      if (typeof mediaQueryList.removeEventListener === "function") {
        mediaQueryList.removeEventListener("change", handleMediaChange)
      } else {
        mediaQueryList.removeListener(handleMediaChange)
      }
    }
  }, [])

  return null
}

function RuntimeSettingsSyncController() {
  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    let disposed = false

    const syncSettings = () =>
      syncRuntimeSettings(getAppSettings()).catch((error) => {
        if (disposed) {
          return
        }

        console.error("Failed to sync runtime settings", error)
      })

    const handleSettingsUpdated = () => {
      void syncSettings()
    }
    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== APP_SETTINGS_STORAGE_KEY) {
        return
      }

      void syncSettings()
    }

    void syncSettings()
    window.addEventListener(APP_SETTINGS_UPDATED_EVENT, handleSettingsUpdated)
    window.addEventListener("storage", handleStorage)

    return () => {
      disposed = true
      window.removeEventListener(
        APP_SETTINGS_UPDATED_EVENT,
        handleSettingsUpdated
      )
      window.removeEventListener("storage", handleStorage)
    }
  }, [])

  return null
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ThemeController />
      <RuntimeSettingsSyncController />
      <TooltipProvider>{children}</TooltipProvider>
    </>
  )
}
