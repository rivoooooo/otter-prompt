import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
} from "react-router"
import { useEffect } from "react"

import type { Route } from "./+types/root"
import "@workspace/ui/globals.css"
import "./app-theme.css"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import {
  APP_SETTINGS_STORAGE_KEY,
  APP_SETTINGS_UPDATED_EVENT,
  getAppSettings,
  type ThemeMode,
} from "./lib/app-settings"

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

function applyTheme(themeMode: ThemeMode, mediaQueryList?: MediaQueryList | null) {
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

const themeInitScript = `(() => {
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

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-svh bg-background text-foreground">
        <ThemeController />
        <TooltipProvider>{children}</TooltipProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  return <Outlet />
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!"
  let details = "An unexpected error occurred."
  let stack: string | undefined

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error"
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message
    stack = error.stack
  }

  return (
    <main className="container mx-auto p-4 pt-16">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full overflow-x-auto p-4">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  )
}
