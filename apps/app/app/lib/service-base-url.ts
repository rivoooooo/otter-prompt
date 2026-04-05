const KEY = "otter.serviceBaseUrl"
const DEFAULT_BASE_URL =
  (import.meta.env.VITE_OTTER_API_BASE as string | undefined) ||
  "http://127.0.0.1:8787/api"
let runtimeBaseUrlOverride: string | null = null

declare global {
  interface Window {
    __OTTER_API_BASE__?: string
  }
}

function normalizeBaseUrl(value: string | null | undefined) {
  const nextValue = value?.trim()

  return nextValue ? nextValue : null
}

export function setRuntimeServiceBaseUrl(url: string) {
  runtimeBaseUrlOverride = normalizeBaseUrl(url)
}

export function clearRuntimeServiceBaseUrl() {
  runtimeBaseUrlOverride = null
}

export function getRuntimeServiceBaseUrl() {
  return (
    runtimeBaseUrlOverride ||
    normalizeBaseUrl(
      typeof window !== "undefined" ? window.__OTTER_API_BASE__ : null
    )
  )
}

export function getDefaultBaseUrl() {
  return DEFAULT_BASE_URL
}

export function getServiceBaseUrl() {
  const runtimeBaseUrl = getRuntimeServiceBaseUrl()

  if (runtimeBaseUrl) {
    return runtimeBaseUrl
  }

  if (typeof window === "undefined") {
    return DEFAULT_BASE_URL
  }
  const storedBaseUrl = window.localStorage.getItem(KEY)
  if (!storedBaseUrl) {
    return DEFAULT_BASE_URL
  }

  const resolvedStoredBaseUrl = normalizeBaseUrl(storedBaseUrl)
  if (!resolvedStoredBaseUrl) {
    return DEFAULT_BASE_URL
  }

  return resolvedStoredBaseUrl
}

export function setServiceBaseUrl(url: string) {
  if (typeof window === "undefined") {
    return
  }
  window.localStorage.setItem(KEY, url)
}

export function resetServiceBaseUrl() {
  if (typeof window === "undefined") {
    return
  }
  window.localStorage.removeItem(KEY)
}
