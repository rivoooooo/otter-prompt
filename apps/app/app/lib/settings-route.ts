import type { Dispatch, SetStateAction } from "react"
import type { AppSettings } from "./app-settings"

export type SettingsNavItem = {
  label: string
  to: string
  description: string
  matchPrefix?: string
}

export const SETTINGS_NAV_ITEMS: SettingsNavItem[] = [
  {
    label: "General",
    to: "/settings/general",
    description: "Workspace, connection and launch behavior",
  },
  {
    label: "Providers",
    to: "/settings/providers",
    description: "API keys, model defaults and catalog entries",
    matchPrefix: "/settings/providers",
  },
]

export type SettingsRouteContext = {
  draft: AppSettings
  saved: AppSettings
  canSave: boolean
  savedAt: number | null
  setDraft: Dispatch<SetStateAction<AppSettings>>
  saveDraft: () => void
}
