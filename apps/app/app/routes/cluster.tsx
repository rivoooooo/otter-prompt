import { useEffect, useState } from "react"
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

      <div className="app-section-card mb-4 p-4">
        <p className="mb-2 text-sm text-muted-foreground">System prompt</p>
        <Textarea
          value={systemPrompt}
          onChange={(event) => setSystemPrompt(event.target.value)}
          className="min-h-24"
          placeholder="This will be injected to all cluster requests"
        />
      </div>

      <div className="app-section-card app-section-card--dark min-h-0 flex-1 p-4 md:p-6">
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
