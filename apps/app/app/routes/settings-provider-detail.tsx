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
      <div className="flex flex-col">
        <header className="flex flex-wrap items-start justify-between gap-3 pb-5">
          <h2 className="font-heading text-[1.45rem] leading-[1.2] text-foreground">
            Provider Not Found
          </h2>
        </header>
        <Separator />
        <div className="flex flex-wrap justify-start gap-2 pt-[18px]">
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
    <div className="flex flex-col">
      <header className="flex flex-wrap items-start justify-start gap-3 pb-5">
        <Button variant="outline" render={<Link to="/settings/providers" />}>
          <ArrowLeftIcon data-icon="inline-start" />
          Providers
        </Button>
        <div>
          <h2 className="font-heading text-[1.45rem] leading-[1.2] text-foreground">
            {catalog.label}
          </h2>
          <p className="text-[0.9rem] leading-[1.5] text-muted-foreground">
            {providerMeta}
          </p>
        </div>
      </header>

      <section className="flex flex-col gap-[18px] py-[18px]">
        <div>
          <div className="flex flex-col gap-[14px] py-4 lg:flex-row lg:items-center lg:justify-between lg:gap-7">
            <div className="flex min-w-0 flex-col gap-1 lg:basis-[17rem]">
              <p className="text-[0.98rem] font-medium text-foreground">
                Website
              </p>
            </div>
            <div className="min-w-0 text-[0.9rem] text-foreground lg:flex-1">
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
          <div className="flex flex-col gap-[14px] border-t border-[rgb(232_230_220_/_90%)] py-4 lg:flex-row lg:items-center lg:justify-between lg:gap-7">
            <div className="flex min-w-0 flex-col gap-1 lg:basis-[17rem]">
              <p className="text-[0.98rem] font-medium text-foreground">Docs</p>
            </div>
            <div className="min-w-0 text-[0.9rem] text-foreground lg:flex-1">
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

      <section className="flex flex-col gap-[18px] py-[18px]">
        <h3 className="font-heading text-[1.12rem] leading-[1.2] text-foreground">
          Access
        </h3>
        <div>
          <div className="flex flex-col gap-[14px] py-4 lg:flex-row lg:items-center lg:justify-between lg:gap-7">
            <div className="flex min-w-0 flex-col gap-1 lg:basis-[17rem]">
              <p className="text-[0.98rem] font-medium text-foreground">
                Enabled
              </p>
            </div>
            <div className="flex items-center lg:flex-1 lg:justify-start">
              <label className="flex min-w-0 items-center gap-2.5 text-[0.92rem] text-foreground">
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

          <div className="flex flex-col gap-[14px] border-t border-[rgb(232_230_220_/_90%)] py-4 lg:flex-row lg:items-center lg:justify-between lg:gap-7">
            <div className="flex min-w-0 flex-col gap-1 lg:basis-[17rem]">
              <p className="text-[0.98rem] font-medium text-foreground">
                API Key
              </p>
            </div>
            <div className="min-w-0 lg:flex-1">
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

      <section className="flex flex-col gap-[18px] py-[18px]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h3 className="font-heading text-[1.12rem] leading-[1.2] text-foreground">
            Models
          </h3>
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
          <div className="flex flex-col gap-1.5 rounded-[18px] bg-[#efe9df] p-4">
            <p className="font-medium text-foreground">No models yet</p>
          </div>
        ) : (
          <div className="flex max-h-[min(52svh,720px)] flex-col overflow-auto max-lg:max-h-none max-lg:overflow-visible">
            {provider.models.map((model, index) => (
              <div
                key={`${model.id}-${index}`}
                className="flex min-w-0 flex-col gap-[14px] py-[18px] not-first:border-t not-first:border-[rgb(232_230_220_/_90%)]"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex min-w-0 items-center gap-2.5 text-[0.92rem] text-foreground">
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

                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <label className="flex min-w-0 flex-col gap-2">
                    <span className="text-[0.88rem] font-medium text-foreground">
                      Model Label
                    </span>
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

                  <label className="flex min-w-0 flex-col gap-2">
                    <span className="text-[0.88rem] font-medium text-foreground">
                      Model ID
                    </span>
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

                  <label className="flex min-w-0 flex-col gap-2">
                    <span className="text-[0.88rem] font-medium text-foreground">
                      Temperature
                    </span>
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

                  <label className="flex min-w-0 flex-col gap-2">
                    <span className="text-[0.88rem] font-medium text-foreground">
                      Context Window
                    </span>
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

      <div className="flex flex-wrap justify-end gap-2 pt-[18px]">
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
