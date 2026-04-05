import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router"
import { Separator } from "@workspace/ui/components/separator"
import { ClusterChat } from "../components/cluster-chat"
import {
  APP_SETTINGS_UPDATED_EVENT,
  getAppSettings,
  getEffectiveProviderConfig,
  getPlaygroundModelOptions,
  type AppSettings,
} from "../lib/app-settings"

export default function ClusterPage() {
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get("projectId") || ""
  const [settings, setSettings] = useState<AppSettings | null>(null)

  useEffect(() => {
    const syncSettings = () => setSettings(getAppSettings())

    syncSettings()
    window.addEventListener(APP_SETTINGS_UPDATED_EVENT, syncSettings)

    return () =>
      window.removeEventListener(APP_SETTINGS_UPDATED_EVENT, syncSettings)
  }, [])

  const effectiveProvider = useMemo(
    () => (settings ? getEffectiveProviderConfig(settings) : null),
    [settings]
  )
  const modelOptions = useMemo(
    () => (settings ? getPlaygroundModelOptions(settings) : []),
    [settings]
  )

  if (!settings || !effectiveProvider) {
    return null
  }

  return (
    <main className="min-h-svh p-4 md:p-6">
      <div className="mb-3 flex flex-col items-start justify-between gap-3 md:flex-row md:items-start">
        <div>
          <p className="text-[0.9375rem] text-muted-foreground">
            Parallel Comparison
          </p>
          <h1 className="font-heading text-[1.6rem] leading-[1.2] md:text-[2rem]">
            Cluster Test
          </h1>
          <p className="text-[0.9375rem] text-muted-foreground">
            Broadcast one message to all conversation clusters.
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 border-b border-border pb-4">
        <div className="rounded-[22px] border border-border/90 bg-card px-4 py-4">
          <p className="text-sm font-medium text-foreground">
            Server-side prompt composition
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {projectId
              ? "Each request will resolve provider settings on the server and inject root main.md from this project when present."
              : "Open Cluster Test from a project page to include that project's root main.md automatically."}
          </p>
        </div>
      </div>

      <Separator />

      <div className="min-h-0 flex-1 bg-[#141413] px-4 py-5 lg:px-6">
        <ClusterChat
          projectId={projectId}
          modelOptions={modelOptions}
          defaultModelKey={
            effectiveProvider.defaultModelOption?.key ||
            modelOptions[0]?.key ||
            ""
          }
        />
      </div>
    </main>
  )
}
