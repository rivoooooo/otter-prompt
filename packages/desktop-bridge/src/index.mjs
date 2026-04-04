const defaultBase =
  (typeof window !== "undefined" && window.__OTTER_API_BASE__) ||
  process.env.OTTER_API_BASE ||
  "http://127.0.0.1:8787"

export async function openInEditor(path, command) {
  const response = await fetch(`${defaultBase}/editor/open`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, command }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "open failed" }))
    throw new Error(body.error || "open failed")
  }
}

export async function getProjects() {
  const response = await fetch(`${defaultBase}/projects`)
  if (!response.ok) {
    throw new Error("failed to load projects")
  }

  const body = await response.json()
  return body.projects || []
}
