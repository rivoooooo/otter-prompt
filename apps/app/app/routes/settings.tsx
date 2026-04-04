import { Link } from "react-router"
import { useEffect, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  getDefaultBaseUrl,
  getServiceBaseUrl,
  resetServiceBaseUrl,
  setServiceBaseUrl,
} from "../lib/service-base-url"

export default function SettingsPage() {
  const [baseUrl, setBaseUrl] = useState("")

  useEffect(() => {
    setBaseUrl(getServiceBaseUrl())
  }, [])

  const defaultBaseUrl = getDefaultBaseUrl()

  return (
    <main className="mx-auto mt-10 max-w-2xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Settings</h1>
        <Button variant="outline" size="sm" render={<Link to="/" />}>
          Back
        </Button>
      </div>

      <section className="space-y-2 rounded-md border border-zinc-200 bg-white p-4">
        <p className="text-sm text-zinc-600">Service Base URL</p>
        <Input
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.target.value)}
          placeholder={defaultBaseUrl}
        />
        <p className="text-xs text-zinc-500">Current default: {defaultBaseUrl}</p>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => {
              setServiceBaseUrl(baseUrl)
            }}
          >
            Save
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              resetServiceBaseUrl()
              setBaseUrl(defaultBaseUrl)
            }}
          >
            Reset Default
          </Button>
        </div>
      </section>
    </main>
  )
}
