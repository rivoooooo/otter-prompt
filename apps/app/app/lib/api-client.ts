import { getServiceBaseUrl } from "./service-base-url"

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
  options?: { apiKey?: string },
) {
  const base = getServiceBaseUrl().replace(/\/+$/, "")
  const nextPath = path.startsWith("/") ? path : `/${path}`
  const headers = new Headers(init?.headers)
  headers.set("Content-Type", headers.get("Content-Type") || "application/json")
  if (options?.apiKey) {
    headers.set("x-otter-api-key", options.apiKey)
  }

  const response = await fetch(`${base}${nextPath}`, {
    ...init,
    headers,
  })

  if (!response.ok) {
    throw new Error(await response.text())
  }

  return response.json() as Promise<T>
}

export function apiStream(path: string, body: unknown, options?: { apiKey?: string }) {
  const base = getServiceBaseUrl().replace(/\/+$/, "")
  const nextPath = path.startsWith("/") ? path : `/${path}`
  const headers = new Headers({ "Content-Type": "application/json" })
  if (options?.apiKey) {
    headers.set("x-otter-api-key", options.apiKey)
  }

  return fetch(`${base}${nextPath}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
}
