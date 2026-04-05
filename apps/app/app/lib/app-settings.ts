import {
  getDefaultBaseUrl,
  getRuntimeServiceBaseUrl,
  getServiceBaseUrl,
  resetServiceBaseUrl,
  setServiceBaseUrl,
} from "./service-base-url"
import {
  getDefaultProviderApiStyle,
  getDefaultProviderId,
  getDefaultProviderModels,
  getProviderCatalog,
  getProviderCatalogEntry,
  isBuiltInProvider,
  type ProviderApiStyle,
} from "./provider-catalog"

const SETTINGS_KEY = "otter.settings.v3"
const LEGACY_SETTINGS_KEYS = ["otter.settings.v2"]
const API_KEY_KEY = "otter.apiKey"
const PROVIDER_KEY = "otter.provider"
const DEFAULT_MODEL_KEY = "otter.defaultModel"
const CLUSTER_OPEN_MODE_KEY = "otter.clusterOpenMode"
const ALLOW_DUPLICATE_LOCAL_PATH_KEY =
  "otter.allowDuplicateLocalPathAsNewProject"

export type ClusterOpenMode = "dialog" | "page"
export type TokenCounterPreset = "chatgpt" | "claude"
export type ThemeMode = "light" | "dark" | "system"
export type ProviderSource = "builtin" | "custom"

export const APP_SETTINGS_STORAGE_KEY = SETTINGS_KEY
export const APP_SETTINGS_UPDATED_EVENT = "otter:settings-updated"

export type ModelSettings = {
  id: string
  label: string
  temperature: number
  contextWindow: number
  apiStyleOverride: ProviderApiStyle | null
}

export type ProviderSettings = {
  id: string
  label: string
  source: ProviderSource
  enabled: boolean
  apiKey: string
  baseUrl: string
  apiStyle: ProviderApiStyle
  defaultModelId: string
  models: ModelSettings[]
}

export type GeneralSettings = {
  serviceBaseUrl: string
  defaultProviderId: string
  clusterOpenMode: ClusterOpenMode
  allowDuplicateLocalPathAsNewProject: boolean
  tokenCounterPreset: TokenCounterPreset
  themeMode: ThemeMode
}

export type AppSettings = {
  general: GeneralSettings
  providers: Record<string, ProviderSettings>
}

export type ProviderModelRuntimeConfig = {
  key: string
  providerId: string
  providerLabel: string
  modelId: string
  modelLabel: string
  apiKey: string
  baseUrl: string
  apiStyle: ProviderApiStyle
}

export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  serviceBaseUrl: getDefaultBaseUrl(),
  defaultProviderId: getDefaultProviderId(),
  clusterOpenMode: "dialog",
  allowDuplicateLocalPathAsNewProject: false,
  tokenCounterPreset: "chatgpt",
  themeMode: "system",
}

function cloneModel(model: ModelSettings): ModelSettings {
  return {
    id: model.id,
    label: model.label,
    temperature: model.temperature,
    contextWindow: model.contextWindow,
    apiStyleOverride: model.apiStyleOverride,
  }
}

function createModelFromCatalog(model: {
  id: string
  label: string
  temperature: number
  contextWindow: number
}): ModelSettings {
  return {
    id: model.id,
    label: model.label,
    temperature: model.temperature,
    contextWindow: model.contextWindow,
    apiStyleOverride: null,
  }
}

function cloneProvider(provider: ProviderSettings): ProviderSettings {
  return {
    id: provider.id,
    label: provider.label,
    source: provider.source,
    enabled: provider.enabled,
    apiKey: provider.apiKey,
    baseUrl: provider.baseUrl,
    apiStyle: provider.apiStyle,
    defaultModelId: provider.defaultModelId,
    models: provider.models.map(cloneModel),
  }
}

function normalizeApiStyle(
  value: unknown,
  fallback: ProviderApiStyle
): ProviderApiStyle {
  return value === "anthropic" ? "anthropic" : fallback
}

function buildProviderLabel(providerId: string) {
  return (
    providerId
      .split(/[-_]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ") || "Custom Provider"
  )
}

function normalizeModel(
  candidate: Partial<ModelSettings> | null | undefined
): ModelSettings | null {
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
    apiStyleOverride:
      candidate?.apiStyleOverride === "openai" ||
      candidate?.apiStyleOverride === "anthropic"
        ? candidate.apiStyleOverride
        : null,
  }
}

export function getDefaultProviderSettings(
  providerId: string,
  overrides: Partial<
    Pick<ProviderSettings, "label" | "source" | "apiStyle" | "baseUrl">
  > = {}
): ProviderSettings {
  const catalog = getProviderCatalogEntry(providerId)
  const defaultModels = getDefaultProviderModels(providerId)
  const source = overrides.source || (catalog ? "builtin" : "custom")

  return {
    id: providerId,
    label: overrides.label || catalog?.label || buildProviderLabel(providerId),
    source,
    enabled: providerId === getDefaultProviderId(),
    apiKey: "",
    baseUrl: overrides.baseUrl || "",
    apiStyle:
      overrides.apiStyle ||
      catalog?.defaultApiStyle ||
      getDefaultProviderApiStyle(providerId),
    defaultModelId: defaultModels[0]?.id || "",
    models: defaultModels.map(createModelFromCatalog),
  }
}

function createBuiltInProvidersRecord() {
  return Object.fromEntries(
    getProviderCatalog().map((entry) => [
      entry.id,
      getDefaultProviderSettings(entry.id),
    ])
  ) as Record<string, ProviderSettings>
}

export function createCustomProviderSettings(providerId: string) {
  return getDefaultProviderSettings(providerId, {
    source: "custom",
    label: buildProviderLabel(providerId),
  })
}

export function createDefaultAppSettings(): AppSettings {
  return {
    general: { ...DEFAULT_GENERAL_SETTINGS },
    providers: createBuiltInProvidersRecord(),
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
  const defaults = createBuiltInProvidersRecord()
  const result: Record<string, ProviderSettings> = Object.fromEntries(
    Object.entries(defaults).map(([providerId, provider]) => [
      providerId,
      cloneProvider(provider),
    ])
  )

  if (!rawProviders || typeof rawProviders !== "object") {
    return result
  }

  for (const [providerId, rawProvider] of Object.entries(rawProviders)) {
    const candidate = rawProvider as Partial<ProviderSettings> | null
    const catalog = getProviderCatalogEntry(providerId)
    const source: ProviderSource =
      candidate?.source === "custom" || !catalog ? "custom" : "builtin"
    const base =
      result[providerId] ||
      getDefaultProviderSettings(providerId, {
        source,
        label: String(candidate?.label || "").trim() || undefined,
      })
    const models = Array.isArray(candidate?.models)
      ? candidate.models
          .map((model) => normalizeModel(model as Partial<ModelSettings>))
          .filter((model): model is ModelSettings => Boolean(model))
      : base.models.map(cloneModel)
    const defaultModelIdCandidate = String(
      candidate?.defaultModelId || ""
    ).trim()

    result[providerId] = {
      id: providerId,
      label:
        String(candidate?.label || "").trim() ||
        base.label ||
        buildProviderLabel(providerId),
      source,
      enabled:
        typeof candidate?.enabled === "boolean"
          ? candidate.enabled
          : base.enabled,
      apiKey: String(candidate?.apiKey || base.apiKey || ""),
      baseUrl: String(candidate?.baseUrl || base.baseUrl || "").trim(),
      apiStyle: normalizeApiStyle(
        candidate?.apiStyle,
        base.apiStyle || getDefaultProviderApiStyle(providerId)
      ),
      defaultModelId: models.some(
        (model) => model.id === defaultModelIdCandidate
      )
        ? defaultModelIdCandidate
        : models[0]?.id || base.defaultModelId || "",
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
  const defaultProviderId = providers[requestedProviderId]
    ? requestedProviderId
    : Object.keys(providers)[0] || defaults.general.defaultProviderId

  return {
    general: {
      serviceBaseUrl: getServiceBaseUrl(),
      defaultProviderId,
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
      themeMode:
        candidate?.general?.themeMode === "light" ||
        candidate?.general?.themeMode === "dark"
          ? candidate.general.themeMode
          : defaults.general.themeMode,
    },
    providers,
  } satisfies AppSettings
}

function readLegacyStructuredSettings() {
  if (typeof window === "undefined") {
    return null
  }

  for (const key of LEGACY_SETTINGS_KEYS) {
    const raw = window.localStorage.getItem(key)
    if (!raw) {
      continue
    }

    try {
      return JSON.parse(raw) as Partial<AppSettings>
    } catch {
      continue
    }
  }

  return null
}

export function migrateLegacySettings() {
  const structured = readLegacyStructuredSettings()
  if (structured) {
    return normalizeSettings(structured)
  }

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
  next.general.themeMode = DEFAULT_GENERAL_SETTINGS.themeMode
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

export function listProviderSettings(
  settings: AppSettings = getAppSettings()
): ProviderSettings[] {
  const providers = Object.values(settings.providers).map(cloneProvider)
  const builtInOrder = new Map(
    getProviderCatalog().map((entry, index) => [entry.id, index])
  )

  return providers.sort((left, right) => {
    const leftBuiltIn = isBuiltInProvider(left.id)
    const rightBuiltIn = isBuiltInProvider(right.id)

    if (leftBuiltIn && rightBuiltIn) {
      return (
        (builtInOrder.get(left.id) || 0) - (builtInOrder.get(right.id) || 0)
      )
    }

    if (leftBuiltIn) {
      return -1
    }

    if (rightBuiltIn) {
      return 1
    }

    return left.label.localeCompare(right.label)
  })
}

export function getProviderDefaultModel(provider: ProviderSettings) {
  return (
    provider.models.find((model) => model.id === provider.defaultModelId) ||
    provider.models[0] ||
    null
  )
}

export function getModelRuntimeConfig(
  provider: ProviderSettings,
  model: ModelSettings
): ProviderModelRuntimeConfig {
  return {
    key: `${provider.id}:${model.id}`,
    providerId: provider.id,
    providerLabel: provider.label,
    modelId: model.id,
    modelLabel: model.label,
    apiKey: provider.apiKey,
    baseUrl: provider.baseUrl,
    apiStyle: model.apiStyleOverride || provider.apiStyle,
  }
}

export function getPlaygroundModelOptions(
  settings: AppSettings = getAppSettings()
) {
  return listProviderSettings(settings).flatMap((provider) =>
    provider.enabled
      ? provider.models.map((model) => getModelRuntimeConfig(provider, model))
      : []
  )
}

export function getEffectiveProviderConfig(
  settings: AppSettings = getAppSettings()
) {
  const requestedProviderId = settings.general.defaultProviderId
  const requestedProvider = getProviderSettings(settings, requestedProviderId)
  const enabledProvider = listProviderSettings(settings).find(
    (provider) => provider.enabled
  )
  const provider = requestedProvider.enabled
    ? requestedProvider
    : enabledProvider || requestedProvider
  const catalog = getProviderCatalogEntry(provider.id)
  const defaultModel = getProviderDefaultModel(provider)

  return {
    providerId: provider.id,
    apiKey: provider.apiKey,
    baseUrl: provider.baseUrl,
    apiStyle: provider.apiStyle,
    defaultModel: defaultModel?.id || "",
    defaultModelOption: defaultModel
      ? getModelRuntimeConfig(provider, defaultModel)
      : null,
    provider,
    catalog,
  }
}

export function saveAppSettings(next: AppSettings) {
  if (typeof window === "undefined") {
    return
  }

  const runtimeServiceBaseUrl = getRuntimeServiceBaseUrl()
  const normalized = normalizeSettings(next)
  const payload: AppSettings = {
    general: {
      ...normalized.general,
      serviceBaseUrl: getDefaultBaseUrl(),
    },
    providers: Object.fromEntries(
      Object.entries(normalized.providers).map(([providerId, provider]) => [
        providerId,
        cloneProvider(provider),
      ])
    ),
  }

  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload))

  if (
    runtimeServiceBaseUrl &&
    next.general.serviceBaseUrl === runtimeServiceBaseUrl
  ) {
    resetServiceBaseUrl()
  } else if (next.general.serviceBaseUrl) {
    setServiceBaseUrl(next.general.serviceBaseUrl)
  } else {
    resetServiceBaseUrl()
  }

  window.dispatchEvent(
    new CustomEvent(APP_SETTINGS_UPDATED_EVENT, {
      detail: normalized,
    })
  )
}
