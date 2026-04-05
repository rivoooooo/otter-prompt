import { getServiceBaseUrl } from "./service-base-url"

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
) {
  const base = getServiceBaseUrl().replace(/\/+$/, "")
  const nextPath = path.startsWith("/") ? path : `/${path}`
  const headers = new Headers(init?.headers)
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
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

export function apiStream(path: string, body: unknown) {
  const base = getServiceBaseUrl().replace(/\/+$/, "")
  const nextPath = path.startsWith("/") ? path : `/${path}`
  const headers = new Headers({ "Content-Type": "application/json" })

  return fetch(`${base}${nextPath}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
}
