const KEY = "otter.serviceBaseUrl"
const DEFAULT_BASE_URL =
  (import.meta.env.VITE_OTTER_API_BASE as string | undefined) || "http://127.0.0.1:8787"

export function getDefaultBaseUrl() {
  return DEFAULT_BASE_URL
}

export function getServiceBaseUrl() {
  if (typeof window === "undefined") {
    return DEFAULT_BASE_URL
  }
  return window.localStorage.getItem(KEY) || DEFAULT_BASE_URL
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
