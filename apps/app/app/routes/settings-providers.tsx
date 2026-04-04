import { Link, useOutletContext } from "react-router"
import { ArrowRightIcon } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"
import {
  getEffectiveProviderConfig,
  getProviderSettings,
} from "../lib/app-settings"
import { getProviderCatalog } from "../lib/provider-catalog"
import type { SettingsRouteContext } from "../lib/settings-route"

export default function SettingsProvidersRoute() {
  const { draft } = useOutletContext<SettingsRouteContext>()
  const effective = getEffectiveProviderConfig(draft)

  return (
    <div className="settings-panel">
      <header className="settings-panel-header settings-panel-header--split">
        <h2 className="settings-panel-title">Providers</h2>
        <p className="settings-panel-meta">{effective.providerId}</p>
      </header>

      <div className="settings-provider-list-clean">
        {getProviderCatalog().map((entry, index) => {
          const provider = getProviderSettings(draft, entry.id)
          const meta = [
            draft.general.defaultProviderId === entry.id ? "Default" : null,
            entry.runtimeStatus === "native" ? "Runtime ready" : "Catalog only",
            provider.enabled ? "Enabled" : "Disabled",
            `${provider.models.length} models`,
            provider.defaultModelId || "No default model",
          ]
            .filter(Boolean)
            .join(" · ")

          return (
            <div key={entry.id}>
              {index > 0 ? <Separator /> : null}
              <section className="settings-provider-list-row">
                <div className="settings-provider-list-copy">
                  <h3 className="settings-provider-list-title">
                    {entry.label}
                  </h3>
                  <p className="settings-provider-list-meta">{meta}</p>
                </div>
                <div className="settings-provider-list-action">
                  <Button
                    variant="outline"
                    render={<Link to={`/settings/providers/${entry.id}`} />}
                  >
                    Manage
                    <ArrowRightIcon data-icon="inline-end" />
                  </Button>
                </div>
              </section>
            </div>
          )
        })}
      </div>
    </div>
  )
}
