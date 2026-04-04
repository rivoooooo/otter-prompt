import { Link } from "react-router"
import { useEffect, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { SettingsForm } from "../components/settings-form"
import { getAppSettings, saveAppSettings, type AppSettings } from "../lib/app-settings"

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null)

  useEffect(() => {
    setSettings(getAppSettings())
  }, [])

  if (!settings) {
    return null
  }

  return (
    <main className="mx-auto min-h-svh w-full max-w-4xl p-4 md:p-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-heading text-2xl">Settings</h1>
        <Button variant="outline" render={<Link to="/" />}>
          Back
        </Button>
      </div>
      <SettingsForm
        initialSettings={settings}
        onSave={(next) => {
          setSettings(next)
          saveAppSettings(next)
        }}
      />
    </main>
  )
}
