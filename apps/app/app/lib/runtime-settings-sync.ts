import type { AppSettings } from "./app-settings"
import { apiRequest } from "./api-client"

export async function syncRuntimeSettings(settings: AppSettings) {
  await apiRequest("/state/settings", {
    method: "PUT",
    body: JSON.stringify({ settings }),
  })
}
