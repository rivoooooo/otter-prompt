import { useEffect, useMemo, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { apiRequest } from "../lib/api-client"
import type { AppSettings } from "../lib/app-settings"
import { DEFAULT_SETTINGS } from "../lib/app-settings"

type SettingsFormProps = {
  initialSettings: AppSettings
  onSave: (settings: AppSettings) => void
}

export function SettingsForm({ initialSettings, onSave }: SettingsFormProps) {
  const [draft, setDraft] = useState<AppSettings>(initialSettings)
  const [modelSuggestions, setModelSuggestions] = useState<string[]>([])

  useEffect(() => {
    setDraft(initialSettings)
  }, [initialSettings])

  const canResetBaseUrl = useMemo(
    () => draft.serviceBaseUrl !== DEFAULT_SETTINGS.serviceBaseUrl,
    [draft.serviceBaseUrl],
  )

  useEffect(() => {
    apiRequest<{ models?: string[] }>("/models")
      .then((body) => setModelSuggestions(body.models || []))
      .catch(() => setModelSuggestions([]))
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Settings</CardTitle>
        <CardDescription>
          Configure service base URL, provider, model and API key.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <label className="flex flex-col gap-2 text-sm">
          <span className="text-muted-foreground">Service Base URL</span>
          <Input
            value={draft.serviceBaseUrl}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                serviceBaseUrl: event.target.value,
              }))
            }
            placeholder={DEFAULT_SETTINGS.serviceBaseUrl}
          />
        </label>

        <label className="flex flex-col gap-2 text-sm">
          <span className="text-muted-foreground">Provider</span>
          <Input
            value={draft.provider}
            onChange={(event) =>
              setDraft((current) => ({ ...current, provider: event.target.value }))
            }
            placeholder="openai"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm">
          <span className="text-muted-foreground">Default model</span>
          <Input
            list="otter-model-suggestions"
            value={draft.defaultModel}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                defaultModel: event.target.value,
              }))
            }
            placeholder="gpt-4.1-mini"
          />
          <datalist id="otter-model-suggestions">
            {modelSuggestions.map((model) => (
              <option key={model} value={model} />
            ))}
          </datalist>
        </label>

        <label className="flex flex-col gap-2 text-sm">
          <span className="text-muted-foreground">API key</span>
          <Input
            type="password"
            value={draft.apiKey}
            onChange={(event) =>
              setDraft((current) => ({ ...current, apiKey: event.target.value }))
            }
            placeholder="sk-..."
          />
        </label>

        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="text-muted-foreground">Cluster test open mode</legend>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="cluster-open-mode"
              checked={draft.clusterOpenMode === "dialog"}
              onChange={() =>
                setDraft((current) => ({ ...current, clusterOpenMode: "dialog" }))
              }
            />
            <span>Open with dialog</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="cluster-open-mode"
              checked={draft.clusterOpenMode === "page"}
              onChange={() =>
                setDraft((current) => ({ ...current, clusterOpenMode: "page" }))
              }
            />
            <span>Open as page</span>
          </label>
        </fieldset>
      </CardContent>

      <CardFooter className="flex gap-2">
        <Button
          variant="outline"
          onClick={() =>
            setDraft((current) => ({
              ...current,
              serviceBaseUrl: DEFAULT_SETTINGS.serviceBaseUrl,
            }))
          }
          disabled={!canResetBaseUrl}
        >
          Reset URL
        </Button>
        <Button onClick={() => onSave(draft)}>Save</Button>
      </CardFooter>
    </Card>
  )
}
