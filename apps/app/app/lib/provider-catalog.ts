export type ProviderApiStyle = "openai" | "anthropic"

export type ProviderCatalogModel = {
  id: string
  label: string
  temperature: number
  contextWindow: number
}

export type ProviderCatalogEntry = {
  id: string
  label: string
  description: string
  websiteUrl: string
  docsUrl: string
  supportsCustomModels: boolean
  runtimeStatus: "native" | "catalog-only"
  defaultApiStyle: ProviderApiStyle
  models: ProviderCatalogModel[]
}

const PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  {
    id: "openai",
    label: "OpenAI",
    description: "Native runtime provider for OpenAI-compatible chat APIs.",
    websiteUrl: "https://openai.com",
    docsUrl: "https://platform.openai.com/docs/models",
    supportsCustomModels: true,
    runtimeStatus: "native",
    defaultApiStyle: "openai",
    models: [
      {
        id: "gpt-4.1-mini",
        label: "GPT-4.1 Mini",
        temperature: 1,
        contextWindow: 1047576,
      },
      {
        id: "gpt-4.1",
        label: "GPT-4.1",
        temperature: 1,
        contextWindow: 1047576,
      },
      {
        id: "gpt-4o-mini",
        label: "GPT-4o Mini",
        temperature: 1,
        contextWindow: 128000,
      },
      {
        id: "gpt-4o",
        label: "GPT-4o",
        temperature: 1,
        contextWindow: 128000,
      },
    ],
  },
  {
    id: "anthropic",
    label: "Anthropic",
    description:
      "Native runtime provider for Anthropic-compatible message APIs.",
    websiteUrl: "https://www.anthropic.com",
    docsUrl: "https://docs.anthropic.com",
    supportsCustomModels: true,
    runtimeStatus: "native",
    defaultApiStyle: "anthropic",
    models: [
      {
        id: "claude-sonnet-4-5",
        label: "Claude Sonnet 4.5",
        temperature: 1,
        contextWindow: 200000,
      },
      {
        id: "claude-opus-4-1",
        label: "Claude Opus 4.1",
        temperature: 1,
        contextWindow: 200000,
      },
    ],
  },
  {
    id: "google",
    label: "Google",
    description:
      "Built-in catalog entry for Gemini-style providers. Adjust API style and base URL to match your gateway.",
    websiteUrl: "https://ai.google.dev",
    docsUrl: "https://ai.google.dev/gemini-api/docs/models",
    supportsCustomModels: true,
    runtimeStatus: "catalog-only",
    defaultApiStyle: "openai",
    models: [],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    description:
      "Aggregator-style provider catalog entry for OpenAI-compatible multi-model gateways.",
    websiteUrl: "https://openrouter.ai",
    docsUrl: "https://openrouter.ai/docs",
    supportsCustomModels: true,
    runtimeStatus: "catalog-only",
    defaultApiStyle: "openai",
    models: [],
  },
]

function cloneModel(model: ProviderCatalogModel): ProviderCatalogModel {
  return {
    id: model.id,
    label: model.label,
    temperature: model.temperature,
    contextWindow: model.contextWindow,
  }
}

export function getProviderCatalog(): ProviderCatalogEntry[] {
  return PROVIDER_CATALOG.map((entry) => ({
    ...entry,
    models: entry.models.map(cloneModel),
  }))
}

export function getProviderCatalogEntry(providerId: string) {
  return getProviderCatalog().find((entry) => entry.id === providerId) || null
}

export function getDefaultProviderId() {
  return PROVIDER_CATALOG[0]?.id || "openai"
}

export function getDefaultProviderModels(providerId: string) {
  return getProviderCatalogEntry(providerId)?.models.map(cloneModel) || []
}

export function getDefaultProviderApiStyle(
  providerId: string
): ProviderApiStyle {
  return getProviderCatalogEntry(providerId)?.defaultApiStyle || "openai"
}

export function isBuiltInProvider(providerId: string) {
  return PROVIDER_CATALOG.some((entry) => entry.id === providerId)
}
