import { useMemo } from "react"
import { Link, useOutletContext } from "react-router"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Separator } from "@workspace/ui/components/separator"
import { cn } from "@workspace/ui/lib/utils"
import {
  DEFAULT_GENERAL_SETTINGS,
  getEffectiveProviderConfig,
} from "../lib/app-settings"
import { getProviderCatalog } from "../lib/provider-catalog"
import type { SettingsRouteContext } from "../lib/settings-route"

export default function SettingsGeneralRoute() {
  const { draft, saved, setDraft, saveDraft } =
    useOutletContext<SettingsRouteContext>()
  const catalog = getProviderCatalog()
  const effective = getEffectiveProviderConfig(draft)

  const hasGeneralChanges = useMemo(
    () => JSON.stringify(saved.general) !== JSON.stringify(draft.general),
    [saved.general, draft.general]
  )

  return (
    <div className="settings-panel">
      <header className="settings-panel-header">
        <h2 className="settings-panel-title">General</h2>
      </header>

      <section className="settings-group">
        <h3 className="settings-group-title">Connection</h3>
        <div className="settings-item-list">
          <div className="settings-item settings-item--split">
            <div className="settings-item-copy">
              <p className="settings-item-label">Service Base URL</p>
              <p className="settings-item-hint">
                API endpoint for app requests.
              </p>
            </div>
            <div className="settings-item-control">
              <Input
                value={draft.general.serviceBaseUrl}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    general: {
                      ...current.general,
                      serviceBaseUrl: event.target.value,
                    },
                  }))
                }
                placeholder={DEFAULT_GENERAL_SETTINGS.serviceBaseUrl}
              />
            </div>
          </div>

          <div className="settings-item settings-item--split">
            <div className="settings-item-copy">
              <p className="settings-item-label">Effective Runtime</p>
            </div>
            <div className="settings-item-control">
              <div className="settings-runtime-block">
                <p className="settings-runtime-primary">
                  {effective.catalog?.label || effective.providerId}
                </p>
                <p className="settings-runtime-secondary">
                  {effective.defaultModel || "No default model"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Separator />

      <section className="settings-group">
        <div className="settings-group-header">
          <h3 className="settings-group-title">Provider</h3>
          <Button variant="outline" render={<Link to="/settings/providers" />}>
            Manage
          </Button>
        </div>
        <div className="settings-select-list">
          {catalog.map((entry) => {
            const provider = draft.providers[entry.id]
            const isActive = draft.general.defaultProviderId === entry.id
            const meta = [
              provider?.enabled ? "Enabled" : "Disabled",
              `${provider?.models.length || 0} models`,
            ].join(" · ")

            return (
              <button
                key={entry.id}
                type="button"
                className={cn(
                  "settings-select-row",
                  isActive && "settings-select-row--active"
                )}
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    general: {
                      ...current.general,
                      defaultProviderId: entry.id,
                    },
                  }))
                }
              >
                <span className="settings-select-row-title">{entry.label}</span>
                <span className="settings-select-row-meta">{meta}</span>
              </button>
            )
          })}
        </div>
      </section>

      <Separator />

      <section className="settings-group">
        <h3 className="settings-group-title">Behavior</h3>
        <div className="settings-item-list">
          <div className="settings-item">
            <div className="settings-item-copy">
              <p className="settings-item-label">Cluster Test Open Mode</p>
            </div>
            <fieldset className="settings-option-stack">
              <label className="settings-choice-item">
                <input
                  type="radio"
                  name="cluster-open-mode"
                  checked={draft.general.clusterOpenMode === "dialog"}
                  onChange={() =>
                    setDraft((current) => ({
                      ...current,
                      general: {
                        ...current.general,
                        clusterOpenMode: "dialog",
                      },
                    }))
                  }
                />
                <span>Open with dialog</span>
              </label>
              <label className="settings-choice-item">
                <input
                  type="radio"
                  name="cluster-open-mode"
                  checked={draft.general.clusterOpenMode === "page"}
                  onChange={() =>
                    setDraft((current) => ({
                      ...current,
                      general: { ...current.general, clusterOpenMode: "page" },
                    }))
                  }
                />
                <span>Open as page</span>
              </label>
            </fieldset>
          </div>

          <div className="settings-item">
            <div className="settings-item-copy">
              <p className="settings-item-label">Token Counter</p>
              <p className="settings-item-hint">
                Choose the built-in estimator used in document footer stats.
              </p>
            </div>
            <fieldset className="settings-option-stack">
              <label className="settings-choice-item">
                <input
                  type="radio"
                  name="token-counter-preset"
                  checked={draft.general.tokenCounterPreset === "chatgpt"}
                  onChange={() =>
                    setDraft((current) => ({
                      ...current,
                      general: {
                        ...current.general,
                        tokenCounterPreset: "chatgpt",
                      },
                    }))
                  }
                />
                <span>ChatGPT</span>
              </label>
              <label className="settings-choice-item">
                <input
                  type="radio"
                  name="token-counter-preset"
                  checked={draft.general.tokenCounterPreset === "claude"}
                  onChange={() =>
                    setDraft((current) => ({
                      ...current,
                      general: {
                        ...current.general,
                        tokenCounterPreset: "claude",
                      },
                    }))
                  }
                />
                <span>Claude</span>
              </label>
            </fieldset>
          </div>

          <div className="settings-item settings-item--split">
            <div className="settings-item-copy">
              <p className="settings-item-label">Project Import Behavior</p>
              <p className="settings-item-hint">
                Allow duplicate local path as new project.
              </p>
            </div>
            <div className="settings-inline-toggle">
              <label className="settings-choice-item">
                <input
                  type="checkbox"
                  checked={draft.general.allowDuplicateLocalPathAsNewProject}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      general: {
                        ...current.general,
                        allowDuplicateLocalPathAsNewProject:
                          event.target.checked,
                      },
                    }))
                  }
                />
                <span>Enabled</span>
              </label>
            </div>
          </div>
        </div>
      </section>

      <Separator />

      <div className="settings-actions-row">
        <Button
          variant="outline"
          onClick={() =>
            setDraft((current) => ({
              ...current,
              general: { ...DEFAULT_GENERAL_SETTINGS },
            }))
          }
          disabled={!hasGeneralChanges}
        >
          Reset
        </Button>
        <Button onClick={saveDraft} disabled={!hasGeneralChanges}>
          Save
        </Button>
      </div>
    </div>
  )
}
