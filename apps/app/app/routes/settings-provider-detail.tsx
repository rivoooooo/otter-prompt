import { useMemo } from "react"
import { Link, useNavigate, useOutletContext, useParams } from "react-router"
import { ArrowLeftIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Separator } from "@workspace/ui/components/separator"
import {
  createCustomProviderSettings,
  getDefaultProviderSettings,
  getProviderSettings,
  type ModelSettings,
  type ProviderSettings,
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
    apiStyleOverride: null,
  }
}

function getProviderMeta(provider: ProviderSettings, runtimeLabel: string) {
  return [
    provider.source === "custom" ? "Custom" : "Built-in",
    runtimeLabel,
    provider.enabled ? "Enabled" : "Disabled",
  ].join(" · ")
}

export default function SettingsProviderDetailRoute() {
  const navigate = useNavigate()
  const { providerId = "" } = useParams()
  const { draft, saved, setDraft, saveDraft } =
    useOutletContext<SettingsRouteContext>()
  const catalog = getProviderCatalogEntry(providerId)
  const hasSavedProvider = Boolean(saved.providers[providerId])

  if (
    !catalog &&
    !draft.providers[providerId] &&
    !saved.providers[providerId]
  ) {
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

  const provider = getProviderSettings(draft, providerId)
  const savedProvider = hasSavedProvider
    ? getProviderSettings(saved, providerId)
    : null
  const hasProviderChanges = useMemo(
    () => JSON.stringify(savedProvider || null) !== JSON.stringify(provider),
    [savedProvider, provider]
  )

  function updateProvider(
    updater: (current: ProviderSettings) => ProviderSettings
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

  function removeProvider() {
    setDraft((current) => {
      const nextProviders = { ...current.providers }
      delete nextProviders[providerId]
      const nextDefaultProviderId =
        current.general.defaultProviderId === providerId
          ? Object.keys(nextProviders)[0] || ""
          : current.general.defaultProviderId

      return {
        ...current,
        general: {
          ...current.general,
          defaultProviderId: nextDefaultProviderId,
        },
        providers: nextProviders,
      }
    })

    navigate("/settings/providers")
  }

  function resetProvider() {
    setDraft((current) => {
      const nextProvider =
        savedProvider ||
        (provider.source === "custom"
          ? createCustomProviderSettings(providerId)
          : getDefaultProviderSettings(providerId))

      return {
        ...current,
        providers: {
          ...current.providers,
          [providerId]: nextProvider,
        },
      }
    })
  }

  const runtimeLabel =
    catalog?.runtimeStatus === "native" ? "Runtime ready" : "Catalog only"
  const providerMeta = getProviderMeta(provider, runtimeLabel)

  return (
    <div className="flex flex-col">
      <header className="flex flex-wrap items-start justify-start gap-3 pb-5">
        <Button variant="outline" render={<Link to="/settings/providers" />}>
          <ArrowLeftIcon data-icon="inline-start" />
          Providers
        </Button>
        <div>
          <h2 className="font-heading text-[1.45rem] leading-[1.2] text-foreground">
            {provider.label}
          </h2>
          <p className="text-[0.9rem] leading-[1.5] text-muted-foreground">
            {providerMeta}
          </p>
        </div>
      </header>

      <section className="flex flex-col gap-[18px] py-[18px]">
        <h3 className="font-heading text-[1.12rem] leading-[1.2] text-foreground">
          Provider
        </h3>
        <div>
          <div className="flex flex-col gap-[14px] py-4 lg:flex-row lg:items-center lg:justify-between lg:gap-7">
            <div className="flex min-w-0 flex-col gap-1 lg:basis-[17rem]">
              <p className="text-[0.98rem] font-medium text-foreground">
                Provider Name
              </p>
            </div>
            <div className="min-w-0 lg:flex-1">
              <Input
                value={provider.label}
                onChange={(event) =>
                  updateProvider((current) => ({
                    ...current,
                    label: event.target.value,
                  }))
                }
                placeholder="Custom Provider"
              />
            </div>
          </div>

          <div className="flex flex-col gap-[14px] border-t border-border/90 py-4 lg:flex-row lg:items-start lg:justify-between lg:gap-7">
            <div className="flex min-w-0 flex-col gap-1 lg:basis-[17rem]">
              <p className="text-[0.98rem] font-medium text-foreground">ID</p>
              <p className="text-[0.86rem] leading-[1.5] text-muted-foreground">
                Internal key used in local settings.
              </p>
            </div>
            <div className="min-w-0 lg:flex-1">
              <div className="rounded-2xl bg-secondary/70 px-[14px] py-3 font-mono text-[0.88rem] text-foreground">
                {provider.id}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-[14px] border-t border-border/90 py-4 lg:flex-row lg:items-start lg:justify-between lg:gap-7">
            <div className="flex min-w-0 flex-col gap-1 lg:basis-[17rem]">
              <p className="text-[0.98rem] font-medium text-foreground">
                API Style
              </p>
              <p className="text-[0.86rem] leading-[1.5] text-muted-foreground">
                Provider-level default for all models unless a model overrides
                it.
              </p>
            </div>
            <fieldset className="flex min-w-0 flex-col gap-2.5 lg:flex-1">
              <label className="flex min-w-0 items-center gap-2.5 text-[0.92rem] text-foreground">
                <input
                  type="radio"
                  name={`provider-api-style-${providerId}`}
                  checked={provider.apiStyle === "openai"}
                  onChange={() =>
                    updateProvider((current) => ({
                      ...current,
                      apiStyle: "openai",
                    }))
                  }
                />
                <span>OpenAI style API</span>
              </label>
              <label className="flex min-w-0 items-center gap-2.5 text-[0.92rem] text-foreground">
                <input
                  type="radio"
                  name={`provider-api-style-${providerId}`}
                  checked={provider.apiStyle === "anthropic"}
                  onChange={() =>
                    updateProvider((current) => ({
                      ...current,
                      apiStyle: "anthropic",
                    }))
                  }
                />
                <span>Anthropic style API</span>
              </label>
            </fieldset>
          </div>

          <div className="flex flex-col gap-[14px] border-t border-border/90 py-4 lg:flex-row lg:items-center lg:justify-between lg:gap-7">
            <div className="flex min-w-0 flex-col gap-1 lg:basis-[17rem]">
              <p className="text-[0.98rem] font-medium text-foreground">
                Base URL
              </p>
              <p className="text-[0.86rem] leading-[1.5] text-muted-foreground">
                Example: OpenAI-compatible gateways use `/v1`,
                Anthropic-compatible gateways use `/v1`.
              </p>
            </div>
            <div className="min-w-0 lg:flex-1">
              <Input
                value={provider.baseUrl}
                onChange={(event) =>
                  updateProvider((current) => ({
                    ...current,
                    baseUrl: event.target.value,
                  }))
                }
                placeholder="https://api.example.com/v1"
              />
            </div>
          </div>

          {catalog ? (
            <>
              <div className="flex flex-col gap-[14px] border-t border-border/90 py-4 lg:flex-row lg:items-center lg:justify-between lg:gap-7">
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
              <div className="flex flex-col gap-[14px] border-t border-border/90 py-4 lg:flex-row lg:items-center lg:justify-between lg:gap-7">
                <div className="flex min-w-0 flex-col gap-1 lg:basis-[17rem]">
                  <p className="text-[0.98rem] font-medium text-foreground">
                    Docs
                  </p>
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
            </>
          ) : null}
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

          <div className="flex flex-col gap-[14px] border-t border-border/90 py-4 lg:flex-row lg:items-center lg:justify-between lg:gap-7">
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
                placeholder={
                  provider.apiStyle === "anthropic" ? "sk-ant-..." : "sk-..."
                }
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
          <div className="flex flex-col gap-1.5 rounded-[18px] bg-secondary/70 p-4">
            <p className="font-medium text-foreground">No models yet</p>
          </div>
        ) : (
          <div className="flex max-h-[min(52svh,720px)] flex-col overflow-auto max-lg:max-h-none max-lg:overflow-visible">
            {provider.models.map((model, index) => (
              <div
                key={`${model.id}-${index}`}
                className="flex min-w-0 flex-col gap-[14px] py-[18px] not-first:border-t not-first:border-border/90"
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
                      API Style
                    </span>
                    <select
                      value={model.apiStyleOverride || ""}
                      onChange={(event) =>
                        updateModel(index, (current) => ({
                          ...current,
                          apiStyleOverride:
                            event.target.value === "openai" ||
                            event.target.value === "anthropic"
                              ? event.target.value
                              : null,
                        }))
                      }
                      className="h-11 rounded-[16px] border border-input bg-background px-3 text-[0.92rem] text-foreground transition-colors outline-none focus:border-ring"
                    >
                      <option value="">Inherit provider default</option>
                      <option value="openai">OpenAI style</option>
                      <option value="anthropic">Anthropic style</option>
                    </select>
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

                  <label className="flex min-w-0 flex-col gap-2 lg:col-span-2">
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

      <div className="flex flex-wrap justify-between gap-2 pt-[18px]">
        <div>
          {provider.source === "custom" ? (
            <Button variant="outline" onClick={removeProvider}>
              <Trash2Icon data-icon="inline-start" />
              Delete Provider
            </Button>
          ) : null}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            onClick={resetProvider}
            disabled={!hasProviderChanges}
          >
            Reset
          </Button>
          <Button onClick={saveDraft} disabled={!hasProviderChanges}>
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}
