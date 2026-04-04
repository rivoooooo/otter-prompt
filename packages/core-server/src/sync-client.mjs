const CLOUD_BASE = process.env.OTTER_CLOUD_BASE || "http://127.0.0.1:9797"

async function request(path, payload) {
  const response = await fetch(`${CLOUD_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(await response.text())
  }

  return response.json()
}

export async function pushToCloud(payload) {
  return request("/sync/push", payload)
}

export async function pullFromCloud(payload) {
  return request("/sync/pull", payload)
}

export async function getCloudSyncStatus(projectId) {
  const response = await fetch(
    `${CLOUD_BASE}/sync/status?projectId=${encodeURIComponent(projectId)}`,
  )
  if (!response.ok) {
    throw new Error(await response.text())
  }

  return response.json()
}
