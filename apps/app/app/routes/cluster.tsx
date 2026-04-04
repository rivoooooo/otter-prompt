import { Link } from "react-router"
import { useEffect, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Textarea } from "@workspace/ui/components/textarea"
import { ClusterChat } from "../components/cluster-chat"
import { getAppSettings, type AppSettings } from "../lib/app-settings"

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

  return (
    <main className="flex min-h-svh flex-col bg-background p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h1 className="font-heading text-2xl">Cluster Test</h1>
          <p className="text-sm text-muted-foreground">
            Broadcast one message to all conversation clusters.
          </p>
        </div>
        <Button variant="outline" render={<Link to="/" />}>
          Back to App
        </Button>
      </div>

      <div className="mb-3 rounded-xl border border-border p-3">
        <p className="mb-2 text-sm text-muted-foreground">System prompt</p>
        <Textarea
          value={systemPrompt}
          onChange={(event) => setSystemPrompt(event.target.value)}
          className="min-h-24"
          placeholder="This will be injected to all cluster requests"
        />
      </div>

      <div className="min-h-0 flex-1">
        <ClusterChat
          systemPrompt={systemPrompt}
          apiKey={settings.apiKey}
          defaultProvider={settings.provider}
          defaultModel={settings.defaultModel}
        />
      </div>
    </main>
  )
}
