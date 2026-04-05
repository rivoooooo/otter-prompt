import { Link, useNavigate, useOutletContext } from "react-router"
import { ArrowRightIcon, PlusIcon } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"
import {
  createCustomProviderSettings,
  getEffectiveProviderConfig,
  listProviderSettings,
} from "../lib/app-settings"
import { getProviderCatalogEntry } from "../lib/provider-catalog"
import type { SettingsRouteContext } from "../lib/settings-route"

function buildCustomProviderId(existingIds: string[]) {
  let index = existingIds.length + 1

  while (existingIds.includes(`custom-provider-${index}`)) {
    index += 1
  }

  return `custom-provider-${index}`
}

export default function SettingsProvidersRoute() {
  const navigate = useNavigate()
  const { draft, setDraft } = useOutletContext<SettingsRouteContext>()
  const effective = getEffectiveProviderConfig(draft)
  const providers = listProviderSettings(draft)

  function addCustomProvider() {
    const providerId = buildCustomProviderId(Object.keys(draft.providers))

    setDraft((current) => ({
      ...current,
      providers: {
        ...current.providers,
        [providerId]: createCustomProviderSettings(providerId),
      },
    }))

    navigate(`/settings/providers/${providerId}`)
  }

  return (
    <div className="flex flex-col">
      <header className="flex flex-wrap items-baseline justify-between gap-3 pb-5">
        <div>
          <h2 className="font-heading text-[1.45rem] leading-[1.2] text-foreground">
            Providers
          </h2>
          <p className="text-[0.9rem] leading-[1.5] text-muted-foreground">
            Effective runtime: {effective.provider.label}
          </p>
        </div>
        <Button variant="outline" onClick={addCustomProvider}>
          <PlusIcon data-icon="inline-start" />
          Add Custom Provider
        </Button>
      </header>

      <div className="flex flex-col">
        {providers.map((provider, index) => {
          const catalog = getProviderCatalogEntry(provider.id)
          const meta = [
            draft.general.defaultProviderId === provider.id ? "Default" : null,
            provider.source === "custom"
              ? "Custom"
              : catalog?.runtimeStatus === "native"
                ? "Runtime ready"
                : "Catalog only",
            provider.enabled ? "Enabled" : "Disabled",
            provider.apiStyle === "openai" ? "OpenAI style" : "Anthropic style",
            `${provider.models.length} models`,
            provider.defaultModelId || "No default model",
          ]
            .filter(Boolean)
            .join(" · ")

          return (
            <div key={provider.id}>
              {index > 0 ? <Separator /> : null}
              <section className="flex flex-wrap items-center justify-between gap-3 py-[18px] lg:flex-nowrap">
                <div className="flex flex-col gap-1">
                  <h3 className="font-heading text-[1.12rem] leading-[1.2] text-foreground">
                    {provider.label}
                  </h3>
                  <p className="text-[0.85rem] leading-[1.5] text-muted-foreground">
                    {meta}
                  </p>
                </div>
                <div className="flex items-center lg:justify-end">
                  <Button
                    variant="outline"
                    render={<Link to={`/settings/providers/${provider.id}`} />}
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
