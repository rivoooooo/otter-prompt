import { useEffect, useRef } from "react"
import { createMemoryRouter, RouterProvider } from "react-router"

import { AppProviders } from "./app-shell"
import { createAppRouteObjects } from "./client-routes"
import {
  clearRuntimeServiceBaseUrl,
  setRuntimeServiceBaseUrl,
} from "./lib/service-base-url"

export type AppInterfaceProps = {
  initialPath?: string
  serviceBaseUrl?: string
  onNavigate?: (path: string) => void
}

export function AppInterface({
  initialPath = "/",
  serviceBaseUrl,
  onNavigate,
}: AppInterfaceProps) {
  const routerRef = useRef(
    createMemoryRouter(createAppRouteObjects(), {
      initialEntries: [initialPath],
    })
  )

  useEffect(() => {
    if (serviceBaseUrl) {
      setRuntimeServiceBaseUrl(serviceBaseUrl)
    } else {
      clearRuntimeServiceBaseUrl()
    }

    return () => {
      clearRuntimeServiceBaseUrl()
    }
  }, [serviceBaseUrl])

  useEffect(() => {
    if (!onNavigate) {
      return
    }

    onNavigate(
      `${routerRef.current.state.location.pathname}${routerRef.current.state.location.search}${routerRef.current.state.location.hash}`
    )

    return routerRef.current.subscribe((state) => {
      onNavigate(
        `${state.location.pathname}${state.location.search}${state.location.hash}`
      )
    })
  }, [onNavigate])

  return (
    <AppProviders>
      <div className="min-h-svh bg-background text-foreground">
        <RouterProvider router={routerRef.current} />
      </div>
    </AppProviders>
  )
}

export default AppInterface
