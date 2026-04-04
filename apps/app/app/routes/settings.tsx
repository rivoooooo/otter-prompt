import { useEffect, useMemo, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { apiRequest } from "../lib/api-client"
import {
  DEFAULT_SETTINGS,
  getAppSettings,
  saveAppSettings,
  type AppSettings,
} from "../lib/app-settings"

export default function SettingsPage() {
  const [saved, setSaved] = useState<AppSettings | null>(null)
  const [draft, setDraft] = useState<AppSettings | null>(null)
  const [modelSuggestions, setModelSuggestions] = useState<string[]>([])
  const [savedAt, setSavedAt] = useState<number | null>(null)

  useEffect(() => {
    const initial = getAppSettings()
    setSaved(initial)
    setDraft(initial)
  }, [])

  useEffect(() => {
    apiRequest<{ models?: string[] }>("/models")
      .then((body) => setModelSuggestions(body.models || []))
      .catch(() => setModelSuggestions([]))
  }, [])

  const canSave = useMemo(() => {
    if (!saved || !draft) {
      return false
    }

    return JSON.stringify(saved) !== JSON.stringify(draft)
  }, [saved, draft])

  if (!draft) {
    return null
  }

  function saveSettings() {
    if (!draft) {
      return
    }

    saveAppSettings(draft)
    setSaved(draft)
    setSavedAt(Date.now())
  }

  return (
    <main className="settings-page">
      <div className="settings-page-header">
        <div>
          <p className="app-page-subtitle">Workspace Preferences</p>
          <h1 className="app-page-title">Settings</h1>
        </div>
        <div className="settings-state-line">
          {canSave ? "Unsaved changes" : "All changes saved"}
          {savedAt && !canSave
            ? ` at ${new Date(savedAt).toLocaleTimeString()}`
            : ""}
        </div>
      </div>

      <section id="connection" className="settings-item">
        <h2 className="settings-item-title">Connection</h2>
        <p className="settings-item-description">
          Configure where requests are sent and which model family is used by
          default.
        </p>
        <div className="settings-fields settings-fields--grid">
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-muted-foreground">Service Base URL</span>
            <Input
              value={draft.serviceBaseUrl}
              onChange={(event) =>
                setDraft((current) =>
                  current
                    ? { ...current, serviceBaseUrl: event.target.value }
                    : current
                )
              }
              placeholder={DEFAULT_SETTINGS.serviceBaseUrl}
            />
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="text-muted-foreground">Provider</span>
            <Input
              value={draft.provider}
              onChange={(event) =>
                setDraft((current) =>
                  current
                    ? { ...current, provider: event.target.value }
                    : current
                )
              }
              placeholder={DEFAULT_SETTINGS.provider}
            />
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="text-muted-foreground">Default model</span>
            <Input
              list="otter-model-suggestions"
              value={draft.defaultModel}
              onChange={(event) =>
                setDraft((current) =>
                  current
                    ? { ...current, defaultModel: event.target.value }
                    : current
                )
              }
              placeholder={DEFAULT_SETTINGS.defaultModel}
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
                setDraft((current) =>
                  current ? { ...current, apiKey: event.target.value } : current
                )
              }
              placeholder="sk-..."
            />
          </label>
        </div>
      </section>

      <section id="behavior" className="settings-item">
        <h2 className="settings-item-title">Behavior</h2>
        <p className="settings-item-description">
          Choose how Cluster Test opens from Home.
        </p>
        <fieldset className="settings-radio-group text-sm">
          <label className="settings-radio-item">
            <input
              type="radio"
              name="cluster-open-mode"
              checked={draft.clusterOpenMode === "dialog"}
              onChange={() =>
                setDraft((current) =>
                  current ? { ...current, clusterOpenMode: "dialog" } : current
                )
              }
            />
            <span>Open with dialog</span>
          </label>
          <label className="settings-radio-item">
            <input
              type="radio"
              name="cluster-open-mode"
              checked={draft.clusterOpenMode === "page"}
              onChange={() =>
                setDraft((current) =>
                  current ? { ...current, clusterOpenMode: "page" } : current
                )
              }
            />
            <span>Open as page</span>
          </label>
        </fieldset>

        <div className="mt-4 flex flex-col gap-2 text-sm">
          <label className="settings-radio-item">
            <input
              type="checkbox"
              checked={draft.allowDuplicateLocalPathAsNewProject}
              onChange={(event) =>
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        allowDuplicateLocalPathAsNewProject:
                          event.target.checked,
                      }
                    : current
                )
              }
            />
            <span>Allow importing same directory as a new project</span>
          </label>
          <p className="text-muted-foreground">
            When disabled, importing an existing directory will reuse and open
            the existing project.
          </p>
        </div>
      </section>

      <div className="settings-actions">
        <Button
          variant="outline"
          onClick={() => setDraft(DEFAULT_SETTINGS)}
          disabled={!canSave}
        >
          Reset
        </Button>
        <Button onClick={saveSettings} disabled={!canSave}>
          Save
        </Button>
      </div>
    </main>
  )
}
