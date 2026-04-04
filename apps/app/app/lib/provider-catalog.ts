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
  models: ProviderCatalogModel[]
}

const PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  {
    id: "openai",
    label: "OpenAI",
    description:
      "Native runtime provider in the current app build. Best fit for the existing chat and cluster test flows.",
    websiteUrl: "https://openai.com",
    docsUrl: "https://platform.openai.com/docs/models",
    supportsCustomModels: true,
    runtimeStatus: "native",
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
      "Prepared catalog entry for Claude models. UI can store keys and custom model metadata before runtime support lands.",
    websiteUrl: "https://www.anthropic.com",
    docsUrl: "https://docs.anthropic.com",
    supportsCustomModels: true,
    runtimeStatus: "catalog-only",
    models: [],
  },
  {
    id: "google",
    label: "Google",
    description:
      "Prepared catalog entry for Gemini models. Use custom model rows until runtime integration is added.",
    websiteUrl: "https://ai.google.dev",
    docsUrl: "https://ai.google.dev/gemini-api/docs/models",
    supportsCustomModels: true,
    runtimeStatus: "catalog-only",
    models: [],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    description:
      "Aggregator-style provider catalog entry for teams that want one API surface for multiple upstream models.",
    websiteUrl: "https://openrouter.ai",
    docsUrl: "https://openrouter.ai/docs",
    supportsCustomModels: true,
    runtimeStatus: "catalog-only",
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
