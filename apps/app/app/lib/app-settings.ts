import {
  getDefaultBaseUrl,
  getServiceBaseUrl,
  resetServiceBaseUrl,
  setServiceBaseUrl,
} from "./service-base-url"

const API_KEY_KEY = "otter.apiKey"
const PROVIDER_KEY = "otter.provider"
const DEFAULT_MODEL_KEY = "otter.defaultModel"
const CLUSTER_OPEN_MODE_KEY = "otter.clusterOpenMode"

export type ClusterOpenMode = "dialog" | "page"

export type AppSettings = {
  apiKey: string
  provider: string
  defaultModel: string
  clusterOpenMode: ClusterOpenMode
  serviceBaseUrl: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  apiKey: "",
  provider: "openai",
  defaultModel: "gpt-4.1-mini",
  clusterOpenMode: "dialog",
  serviceBaseUrl: getDefaultBaseUrl(),
}

function getItem(key: string, fallback: string) {
  if (typeof window === "undefined") {
    return fallback
  }

  return window.localStorage.getItem(key) || fallback
}

export function getAppSettings(): AppSettings {
  return {
    apiKey: getItem(API_KEY_KEY, DEFAULT_SETTINGS.apiKey),
    provider: getItem(PROVIDER_KEY, DEFAULT_SETTINGS.provider),
    defaultModel: getItem(DEFAULT_MODEL_KEY, DEFAULT_SETTINGS.defaultModel),
    clusterOpenMode: getItem(
      CLUSTER_OPEN_MODE_KEY,
      DEFAULT_SETTINGS.clusterOpenMode,
    ) as ClusterOpenMode,
    serviceBaseUrl: getServiceBaseUrl(),
  }
}

export function saveAppSettings(next: AppSettings) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(API_KEY_KEY, next.apiKey)
  window.localStorage.setItem(PROVIDER_KEY, next.provider)
  window.localStorage.setItem(DEFAULT_MODEL_KEY, next.defaultModel)
  window.localStorage.setItem(CLUSTER_OPEN_MODE_KEY, next.clusterOpenMode)

  if (next.serviceBaseUrl) {
    setServiceBaseUrl(next.serviceBaseUrl)
  } else {
    resetServiceBaseUrl()
  }
}
