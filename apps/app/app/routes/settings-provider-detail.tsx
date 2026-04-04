import { useMemo } from "react"
import { Link, useOutletContext, useParams } from "react-router"
import { ArrowLeftIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Separator } from "@workspace/ui/components/separator"
import {
  getDefaultProviderSettings,
  getProviderSettings,
  type ModelSettings,
} from "../lib/app-settings"
import { getProviderCatalogEntry } from "../lib/provider-catalog"
import type { SettingsRouteContext } from "../lib/settings-route"

function parseNumberInput(value: string, fallback: number) {
  if (!value.trim()) {
    return fallback
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function buildNewModel(existingCount: number): ModelSettings {
  const index = existingCount + 1
  return {
    id: `custom-model-${index}`,
    label: `Custom Model ${index}`,
    temperature: 1,
    contextWindow: 128000,
  }
}

export default function SettingsProviderDetailRoute() {
  const { providerId = "" } = useParams()
  const { draft, saved, setDraft, saveDraft } =
    useOutletContext<SettingsRouteContext>()
  const catalog = getProviderCatalogEntry(providerId)

  const provider = getProviderSettings(draft, providerId)
  const savedProvider = getProviderSettings(saved, providerId)
  const hasProviderChanges = useMemo(
    () => JSON.stringify(savedProvider) !== JSON.stringify(provider),
    [savedProvider, provider]
  )

  if (!catalog) {
    return (
      <div className="settings-panel">
        <header className="settings-panel-header">
          <h2 className="settings-panel-title">Provider Not Found</h2>
        </header>
        <Separator />
        <div className="settings-actions-row settings-actions-row--start">
          <Button variant="outline" render={<Link to="/settings/providers" />}>
            <ArrowLeftIcon data-icon="inline-start" />
            Back
          </Button>
        </div>
      </div>
    )
  }

  function updateProvider(
    updater: (current: typeof provider) => typeof provider
  ) {
    setDraft((current) => ({
      ...current,
      providers: {
        ...current.providers,
        [providerId]: updater(getProviderSettings(current, providerId)),
      },
    }))
  }

  function updateModel(
    index: number,
    updater: (model: ModelSettings) => ModelSettings
  ) {
    updateProvider((current) => ({
      ...current,
      models: current.models.map((model, currentIndex) =>
        currentIndex === index ? updater(model) : model
      ),
    }))
  }

  function removeModel(index: number) {
    updateProvider((current) => {
      const nextModels = current.models.filter(
        (_, currentIndex) => currentIndex !== index
      )
      const removedModel = current.models[index]

      return {
        ...current,
        defaultModelId:
          current.defaultModelId === removedModel?.id
            ? nextModels[0]?.id || ""
            : current.defaultModelId,
        models: nextModels,
      }
    })
  }

  const providerMeta = [
    catalog.runtimeStatus === "native" ? "Runtime ready" : "Catalog only",
    provider.enabled ? "Enabled" : "Disabled",
  ].join(" · ")

  return (
    <div className="settings-panel">
      <header className="settings-panel-header settings-panel-header--tight">
        <Button variant="outline" render={<Link to="/settings/providers" />}>
          <ArrowLeftIcon data-icon="inline-start" />
          Providers
        </Button>
        <div>
          <h2 className="settings-panel-title">{catalog.label}</h2>
          <p className="settings-panel-meta">{providerMeta}</p>
        </div>
      </header>

      <section className="settings-group">
        <div className="settings-item-list">
          <div className="settings-item settings-item--split">
            <div className="settings-item-copy">
              <p className="settings-item-label">Website</p>
            </div>
            <div className="settings-item-control settings-link-row">
              <a
                className="underline underline-offset-4"
                href={catalog.websiteUrl}
                target="_blank"
                rel="noreferrer"
              >
                {catalog.websiteUrl}
              </a>
            </div>
          </div>
          <div className="settings-item settings-item--split">
            <div className="settings-item-copy">
              <p className="settings-item-label">Docs</p>
            </div>
            <div className="settings-item-control settings-link-row">
              <a
                className="underline underline-offset-4"
                href={catalog.docsUrl}
                target="_blank"
                rel="noreferrer"
              >
                {catalog.docsUrl}
              </a>
            </div>
          </div>
        </div>
      </section>

      <Separator />

      <section className="settings-group">
        <h3 className="settings-group-title">Access</h3>
        <div className="settings-item-list">
          <div className="settings-item settings-item--split">
            <div className="settings-item-copy">
              <p className="settings-item-label">Enabled</p>
            </div>
            <div className="settings-inline-toggle">
              <label className="settings-choice-item">
                <input
                  type="checkbox"
                  checked={provider.enabled}
                  onChange={(event) =>
                    updateProvider((current) => ({
                      ...current,
                      enabled: event.target.checked,
                    }))
                  }
                />
                <span>Enabled</span>
              </label>
            </div>
          </div>

          <div className="settings-item settings-item--split">
            <div className="settings-item-copy">
              <p className="settings-item-label">API Key</p>
            </div>
            <div className="settings-item-control">
              <Input
                type="password"
                value={provider.apiKey}
                onChange={(event) =>
                  updateProvider((current) => ({
                    ...current,
                    apiKey: event.target.value,
                  }))
                }
                placeholder="sk-..."
              />
            </div>
          </div>
        </div>
      </section>

      <Separator />

      <section className="settings-group">
        <div className="settings-group-header">
          <h3 className="settings-group-title">Models</h3>
          <Button
            variant="outline"
            onClick={() =>
              updateProvider((current) => {
                const nextModel = buildNewModel(current.models.length)
                return {
                  ...current,
                  defaultModelId: current.defaultModelId || nextModel.id,
                  models: [...current.models, nextModel],
                }
              })
            }
          >
            <PlusIcon data-icon="inline-start" />
            Add Model
          </Button>
        </div>

        {provider.models.length === 0 ? (
          <div className="settings-empty-state">
            <p className="font-medium text-foreground">No models yet</p>
          </div>
        ) : (
          <div className="settings-model-editor">
            {provider.models.map((model, index) => (
              <div
                key={`${model.id}-${index}`}
                className="settings-model-editor-row"
              >
                <div className="settings-model-editor-top">
                  <label className="settings-choice-item">
                    <input
                      type="radio"
                      name={`default-model-${providerId}`}
                      checked={provider.defaultModelId === model.id}
                      onChange={() =>
                        updateProvider((current) => ({
                          ...current,
                          defaultModelId: model.id,
                        }))
                      }
                    />
                    <span>Default</span>
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeModel(index)}
                  >
                    <Trash2Icon data-icon="inline-start" />
                    Remove
                  </Button>
                </div>

                <div className="settings-grid-2 settings-grid-2--dense">
                  <label className="settings-field">
                    <span className="settings-field-label">Model Label</span>
                    <Input
                      value={model.label}
                      onChange={(event) =>
                        updateModel(index, (current) => ({
                          ...current,
                          label: event.target.value,
                        }))
                      }
                      placeholder="GPT-4.1 Mini"
                    />
                  </label>

                  <label className="settings-field">
                    <span className="settings-field-label">Model ID</span>
                    <Input
                      value={model.id}
                      onChange={(event) =>
                        updateProvider((current) => {
                          const nextId = event.target.value
                          const previousId = current.models[index]?.id || ""
                          const nextModels = current.models.map(
                            (candidate, currentIndex) =>
                              currentIndex === index
                                ? { ...candidate, id: nextId }
                                : candidate
                          )

                          return {
                            ...current,
                            defaultModelId:
                              current.defaultModelId === previousId
                                ? nextId
                                : current.defaultModelId,
                            models: nextModels,
                          }
                        })
                      }
                      placeholder="gpt-4.1-mini"
                    />
                  </label>

                  <label className="settings-field">
                    <span className="settings-field-label">Temperature</span>
                    <Input
                      inputMode="decimal"
                      value={String(model.temperature)}
                      onChange={(event) =>
                        updateModel(index, (current) => ({
                          ...current,
                          temperature: parseNumberInput(
                            event.target.value,
                            current.temperature
                          ),
                        }))
                      }
                    />
                  </label>

                  <label className="settings-field">
                    <span className="settings-field-label">Context Window</span>
                    <Input
                      inputMode="numeric"
                      value={String(model.contextWindow)}
                      onChange={(event) =>
                        updateModel(index, (current) => ({
                          ...current,
                          contextWindow: parseNumberInput(
                            event.target.value,
                            current.contextWindow
                          ),
                        }))
                      }
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <Separator />

      <div className="settings-actions-row">
        <Button
          variant="outline"
          onClick={() =>
            setDraft((current) => ({
              ...current,
              providers: {
                ...current.providers,
                [providerId]: getDefaultProviderSettings(providerId),
              },
            }))
          }
          disabled={!hasProviderChanges}
        >
          Reset
        </Button>
        <Button onClick={saveDraft} disabled={!hasProviderChanges}>
          Save
        </Button>
      </div>
    </div>
  )
}
