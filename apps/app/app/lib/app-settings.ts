import {
  getDefaultBaseUrl,
  getServiceBaseUrl,
  resetServiceBaseUrl,
  setServiceBaseUrl,
} from "./service-base-url"
import {
  getDefaultProviderId,
  getDefaultProviderModels,
  getProviderCatalog,
  getProviderCatalogEntry,
} from "./provider-catalog"

const SETTINGS_KEY = "otter.settings.v2"
const API_KEY_KEY = "otter.apiKey"
const PROVIDER_KEY = "otter.provider"
const DEFAULT_MODEL_KEY = "otter.defaultModel"
const CLUSTER_OPEN_MODE_KEY = "otter.clusterOpenMode"
const ALLOW_DUPLICATE_LOCAL_PATH_KEY =
  "otter.allowDuplicateLocalPathAsNewProject"

export type ClusterOpenMode = "dialog" | "page"
export type TokenCounterPreset = "chatgpt" | "claude"

export type ModelSettings = {
  id: string
  label: string
  temperature: number
  contextWindow: number
}

export type ProviderSettings = {
  enabled: boolean
  apiKey: string
  defaultModelId: string
  models: ModelSettings[]
}

export type GeneralSettings = {
  serviceBaseUrl: string
  defaultProviderId: string
  clusterOpenMode: ClusterOpenMode
  allowDuplicateLocalPathAsNewProject: boolean
  tokenCounterPreset: TokenCounterPreset
}

export type AppSettings = {
  general: GeneralSettings
  providers: Record<string, ProviderSettings>
}

export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  serviceBaseUrl: getDefaultBaseUrl(),
  defaultProviderId: getDefaultProviderId(),
  clusterOpenMode: "dialog",
  allowDuplicateLocalPathAsNewProject: false,
  tokenCounterPreset: "chatgpt",
}

function cloneModel(model: ModelSettings): ModelSettings {
  return {
    id: model.id,
    label: model.label,
    temperature: model.temperature,
    contextWindow: model.contextWindow,
  }
}

function normalizeModel(candidate: Partial<ModelSettings> | null | undefined) {
  const id = String(candidate?.id || "").trim()
  if (!id) {
    return null
  }

  const temperature = Number(candidate?.temperature)
  const contextWindow = Number(candidate?.contextWindow)

  return {
    id,
    label: String(candidate?.label || id).trim() || id,
    temperature: Number.isFinite(temperature) ? temperature : 1,
    contextWindow: Number.isFinite(contextWindow) ? contextWindow : 128000,
  } satisfies ModelSettings
}

export function getDefaultProviderSettings(
  providerId: string
): ProviderSettings {
  const defaultModels = getDefaultProviderModels(providerId)
  return {
    enabled: providerId === getDefaultProviderId(),
    apiKey: "",
    defaultModelId: defaultModels[0]?.id || "",
    models: defaultModels.map(cloneModel),
  }
}

export function createDefaultAppSettings(): AppSettings {
  const providers = Object.fromEntries(
    getProviderCatalog().map((entry) => [
      entry.id,
      getDefaultProviderSettings(entry.id),
    ])
  )

  return {
    general: { ...DEFAULT_GENERAL_SETTINGS },
    providers,
  }
}

function getItem(key: string, fallback: string) {
  if (typeof window === "undefined") {
    return fallback
  }

  return window.localStorage.getItem(key) || fallback
}

function getBooleanItem(key: string, fallback: boolean) {
  if (typeof window === "undefined") {
    return fallback
  }

  const raw = window.localStorage.getItem(key)
  if (raw === null) {
    return fallback
  }

  return raw === "true"
}

function buildProvidersRecord(rawProviders: unknown) {
  const defaults = createDefaultAppSettings().providers
  const result: Record<string, ProviderSettings> = { ...defaults }

  if (!rawProviders || typeof rawProviders !== "object") {
    return result
  }

  for (const [providerId, rawProvider] of Object.entries(rawProviders)) {
    const base = result[providerId] || getDefaultProviderSettings(providerId)
    const candidate = rawProvider as Partial<ProviderSettings> | null
    const models = Array.isArray(candidate?.models)
      ? candidate.models
          .map((model) => normalizeModel(model as Partial<ModelSettings>))
          .filter((model): model is ModelSettings => Boolean(model))
      : base.models.map(cloneModel)

    result[providerId] = {
      enabled:
        typeof candidate?.enabled === "boolean"
          ? candidate.enabled
          : base.enabled,
      apiKey: String(candidate?.apiKey || base.apiKey || ""),
      defaultModelId: String(
        candidate?.defaultModelId || models[0]?.id || base.defaultModelId || ""
      ),
      models,
    }
  }

  return result
}

function normalizeSettings(candidate: Partial<AppSettings> | null | undefined) {
  const defaults = createDefaultAppSettings()
  const providers = buildProvidersRecord(candidate?.providers)
  const requestedProviderId = String(
    candidate?.general?.defaultProviderId || defaults.general.defaultProviderId
  )
  const hasRequestedProvider = Boolean(providers[requestedProviderId])

  return {
    general: {
      serviceBaseUrl: getServiceBaseUrl(),
      defaultProviderId: hasRequestedProvider
        ? requestedProviderId
        : defaults.general.defaultProviderId,
      clusterOpenMode:
        candidate?.general?.clusterOpenMode === "page" ? "page" : "dialog",
      allowDuplicateLocalPathAsNewProject:
        typeof candidate?.general?.allowDuplicateLocalPathAsNewProject ===
        "boolean"
          ? candidate.general.allowDuplicateLocalPathAsNewProject
          : defaults.general.allowDuplicateLocalPathAsNewProject,
      tokenCounterPreset:
        candidate?.general?.tokenCounterPreset === "claude"
          ? "claude"
          : defaults.general.tokenCounterPreset,
    },
    providers,
  } satisfies AppSettings
}

export function migrateLegacySettings() {
  const legacyProviderId = getItem(PROVIDER_KEY, getDefaultProviderId())
  const next = createDefaultAppSettings()
  const providerSettings =
    next.providers[legacyProviderId] ||
    getDefaultProviderSettings(legacyProviderId)

  next.general.defaultProviderId = legacyProviderId
  next.general.clusterOpenMode = getItem(
    CLUSTER_OPEN_MODE_KEY,
    DEFAULT_GENERAL_SETTINGS.clusterOpenMode
  ) as ClusterOpenMode
  next.general.allowDuplicateLocalPathAsNewProject = getBooleanItem(
    ALLOW_DUPLICATE_LOCAL_PATH_KEY,
    DEFAULT_GENERAL_SETTINGS.allowDuplicateLocalPathAsNewProject
  )
  next.general.tokenCounterPreset = DEFAULT_GENERAL_SETTINGS.tokenCounterPreset
  next.general.serviceBaseUrl = getServiceBaseUrl()
  next.providers[legacyProviderId] = {
    ...providerSettings,
    apiKey: getItem(API_KEY_KEY, ""),
    defaultModelId: getItem(
      DEFAULT_MODEL_KEY,
      providerSettings.defaultModelId || providerSettings.models[0]?.id || ""
    ),
  }

  return next
}

export function getAppSettings(): AppSettings {
  if (typeof window === "undefined") {
    return createDefaultAppSettings()
  }

  const raw = window.localStorage.getItem(SETTINGS_KEY)
  if (!raw) {
    const migrated = migrateLegacySettings()
    saveAppSettings(migrated)
    return migrated
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return normalizeSettings(parsed)
  } catch {
    const fallback = migrateLegacySettings()
    saveAppSettings(fallback)
    return fallback
  }
}

export function getProviderSettings(
  settings: AppSettings,
  providerId: string
): ProviderSettings {
  return (
    settings.providers[providerId] || getDefaultProviderSettings(providerId)
  )
}

export function getEffectiveProviderConfig(
  settings: AppSettings = getAppSettings()
) {
  const requestedProviderId = settings.general.defaultProviderId
  const requestedProvider = getProviderSettings(settings, requestedProviderId)
  const enabledProviderId = Object.entries(settings.providers).find(
    ([, provider]) => provider.enabled
  )?.[0]

  const providerId =
    (requestedProvider.enabled && requestedProviderId) ||
    enabledProviderId ||
    requestedProviderId ||
    getDefaultProviderId()

  const provider = getProviderSettings(settings, providerId)
  const catalog = getProviderCatalogEntry(providerId)
  const defaultModel =
    provider.defaultModelId ||
    provider.models[0]?.id ||
    catalog?.models[0]?.id ||
    ""

  return {
    providerId,
    apiKey: provider.apiKey,
    defaultModel,
    provider,
    catalog,
  }
}

export function saveAppSettings(next: AppSettings) {
  if (typeof window === "undefined") {
    return
  }

  const normalized = normalizeSettings(next)
  const payload: AppSettings = {
    general: {
      ...normalized.general,
      serviceBaseUrl: getDefaultBaseUrl(),
    },
    providers: Object.fromEntries(
      Object.entries(normalized.providers).map(([providerId, provider]) => [
        providerId,
        {
          ...provider,
          models: provider.models.map(cloneModel),
        },
      ])
    ),
  }

  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload))

  if (next.general.serviceBaseUrl) {
    setServiceBaseUrl(next.general.serviceBaseUrl)
  } else {
    resetServiceBaseUrl()
  }
}
