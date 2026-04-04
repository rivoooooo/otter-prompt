import { useEffect, useState } from "react"
import { Separator } from "@workspace/ui/components/separator"
import { Textarea } from "@workspace/ui/components/textarea"
import { ClusterChat } from "../components/cluster-chat"
import {
  getAppSettings,
  getEffectiveProviderConfig,
  type AppSettings,
} from "../lib/app-settings"

const SYSTEM_PROMPT_KEY = "otter.systemPrompt"

export default function ClusterPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [systemPrompt, setSystemPrompt] = useState("")

  useEffect(() => {
    setSettings(getAppSettings())
    setSystemPrompt(window.localStorage.getItem(SYSTEM_PROMPT_KEY) || "")
  }, [])

  useEffect(() => {
    window.localStorage.setItem(SYSTEM_PROMPT_KEY, systemPrompt)
  }, [systemPrompt])

  if (!settings) {
    return null
  }

  const effectiveProvider = getEffectiveProviderConfig(settings)

  return (
    <main className="settings-page">
      <div className="settings-page-header">
        <div>
          <p className="app-page-subtitle">Parallel Comparison</p>
          <h1 className="app-page-title">Cluster Test</h1>
          <p className="app-page-subtitle">
            Broadcast one message to all conversation clusters.
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 border-b border-border pb-4">
        <div>
          <p className="mb-2 text-sm text-muted-foreground">System prompt</p>
          <p className="text-sm text-muted-foreground">
            This prompt is injected into every cluster request.
          </p>
        </div>
        <Textarea
          value={systemPrompt}
          onChange={(event) => setSystemPrompt(event.target.value)}
          className="min-h-24"
          placeholder="This will be injected to all cluster requests"
        />
      </div>

      <Separator />

      <div className="app-cluster-stage min-h-0 flex-1">
        <ClusterChat
          systemPrompt={systemPrompt}
          apiKey={effectiveProvider.apiKey}
          defaultProvider={effectiveProvider.providerId}
          defaultModel={effectiveProvider.defaultModel}
        />
      </div>
    </main>
  )
}
