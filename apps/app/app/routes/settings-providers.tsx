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
    <div className="flex flex-col">
      <header className="flex flex-wrap items-baseline justify-between gap-3 pb-5">
        <h2 className="font-heading text-[1.45rem] leading-[1.2] text-foreground">
          Providers
        </h2>
        <p className="text-[0.9rem] leading-[1.5] text-muted-foreground">
          {effective.providerId}
        </p>
      </header>

      <div className="flex flex-col">
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
              <section className="flex flex-wrap items-center justify-between gap-3 py-[18px] lg:flex-nowrap">
                <div className="flex flex-col gap-1">
                  <h3 className="font-heading text-[1.12rem] leading-[1.2] text-foreground">
                    {entry.label}
                  </h3>
                  <p className="text-[0.85rem] leading-[1.5] text-muted-foreground">
                    {meta}
                  </p>
                </div>
                <div className="flex items-center lg:justify-end">
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
