import { useMemo } from "react"
import { Link, useOutletContext } from "react-router"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Separator } from "@workspace/ui/components/separator"
import { cn } from "@workspace/ui/lib/utils"
import {
  DEFAULT_GENERAL_SETTINGS,
  getEffectiveProviderConfig,
  listProviderSettings,
} from "../lib/app-settings"
import type { SettingsRouteContext } from "../lib/settings-route"

export default function SettingsGeneralRoute() {
  const { draft, saved, setDraft, saveDraft } =
    useOutletContext<SettingsRouteContext>()
  const providers = listProviderSettings(draft)
  const effective = getEffectiveProviderConfig(draft)

  const hasGeneralChanges = useMemo(
    () => JSON.stringify(saved.general) !== JSON.stringify(draft.general),
    [saved.general, draft.general]
  )

  return (
    <div className="flex flex-col">
      <header className="flex flex-wrap items-start justify-between gap-3 pb-5">
        <h2 className="font-heading text-[1.45rem] leading-[1.2] text-foreground">
          General
        </h2>
      </header>

      <section className="flex flex-col gap-[18px] py-[18px]">
        <h3 className="font-heading text-[1.12rem] leading-[1.2] text-foreground">
          Connection
        </h3>
        <div>
          <div className="flex flex-col gap-[14px] py-4 lg:flex-row lg:items-center lg:justify-between lg:gap-7">
            <div className="flex min-w-0 flex-col gap-1 lg:basis-[17rem]">
              <p className="text-[0.98rem] font-medium text-foreground">
                Service Base URL
              </p>
              <p className="text-[0.86rem] leading-[1.5] text-muted-foreground">
                API endpoint for app requests.
              </p>
            </div>
            <div className="min-w-0 lg:flex-1">
              <Input
                value={draft.general.serviceBaseUrl}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    general: {
                      ...current.general,
                      serviceBaseUrl: event.target.value,
                    },
                  }))
                }
                placeholder={DEFAULT_GENERAL_SETTINGS.serviceBaseUrl}
              />
            </div>
          </div>

          <div className="flex flex-col gap-[14px] border-t border-border/90 py-4 lg:flex-row lg:items-center lg:justify-between lg:gap-7">
            <div className="flex min-w-0 flex-col gap-1 lg:basis-[17rem]">
              <p className="text-[0.98rem] font-medium text-foreground">
                Effective Runtime
              </p>
            </div>
            <div className="min-w-0 lg:flex-1">
              <div className="flex flex-col gap-1 rounded-2xl bg-secondary/70 px-[14px] py-3">
                <p className="text-[0.96rem] font-medium text-foreground">
                  {effective.provider.label}
                </p>
                <p className="text-[0.84rem] leading-[1.4] text-muted-foreground">
                  {effective.defaultModel || "No default model"} ·{" "}
                  {effective.apiStyle === "openai"
                    ? "OpenAI style"
                    : "Anthropic style"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Separator />

      <section className="flex flex-col gap-[18px] py-[18px]">
        <h3 className="font-heading text-[1.12rem] leading-[1.2] text-foreground">
          Appearance
        </h3>
        <div className="flex flex-col gap-[14px] py-4">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-[0.98rem] font-medium text-foreground">Theme</p>
            <p className="text-[0.86rem] leading-[1.5] text-muted-foreground">
              Choose how Otter matches Claude&apos;s warm light and dark
              surfaces.
            </p>
          </div>
          <fieldset className="flex flex-col gap-2.5">
            <label className="flex min-w-0 items-center gap-2.5 text-[0.92rem] text-foreground">
              <input
                type="radio"
                name="theme-mode"
                checked={draft.general.themeMode === "system"}
                onChange={() =>
                  setDraft((current) => ({
                    ...current,
                    general: {
                      ...current.general,
                      themeMode: "system",
                    },
                  }))
                }
              />
              <span>Follow system</span>
            </label>
            <label className="flex min-w-0 items-center gap-2.5 text-[0.92rem] text-foreground">
              <input
                type="radio"
                name="theme-mode"
                checked={draft.general.themeMode === "light"}
                onChange={() =>
                  setDraft((current) => ({
                    ...current,
                    general: {
                      ...current.general,
                      themeMode: "light",
                    },
                  }))
                }
              />
              <span>Light</span>
            </label>
            <label className="flex min-w-0 items-center gap-2.5 text-[0.92rem] text-foreground">
              <input
                type="radio"
                name="theme-mode"
                checked={draft.general.themeMode === "dark"}
                onChange={() =>
                  setDraft((current) => ({
                    ...current,
                    general: {
                      ...current.general,
                      themeMode: "dark",
                    },
                  }))
                }
              />
              <span>Dark</span>
            </label>
          </fieldset>
        </div>
      </section>

      <Separator />

      <section className="flex flex-col gap-[18px] py-[18px]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h3 className="font-heading text-[1.12rem] leading-[1.2] text-foreground">
            Provider
          </h3>
          <Button variant="outline" render={<Link to="/settings/providers" />}>
            Manage
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          {providers.map((provider) => {
            const isActive = draft.general.defaultProviderId === provider.id
            const meta = [
              provider.enabled ? "Enabled" : "Disabled",
              provider.apiStyle === "openai"
                ? "OpenAI style"
                : "Anthropic style",
              `${provider.models.length} models`,
            ].join(" · ")

            return (
              <button
                key={provider.id}
                type="button"
                className={cn(
                  "flex w-full min-w-0 flex-col gap-1 rounded-[18px] border-0 bg-transparent px-4 py-[14px] text-left transition-colors duration-150 hover:bg-accent/70",
                  isActive && "bg-accent"
                )}
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    general: {
                      ...current.general,
                      defaultProviderId: provider.id,
                    },
                  }))
                }
              >
                <span className="text-[0.98rem] font-medium text-foreground">
                  {provider.label}
                </span>
                <span className="text-[0.84rem] leading-[1.45] text-muted-foreground">
                  {meta}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <Separator />

      <section className="flex flex-col gap-[18px] py-[18px]">
        <h3 className="font-heading text-[1.12rem] leading-[1.2] text-foreground">
          Behavior
        </h3>
        <div>
          <div className="flex flex-col gap-[14px] py-4">
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-[0.98rem] font-medium text-foreground">
                Cluster Test Open Mode
              </p>
            </div>
            <fieldset className="flex flex-col gap-2.5">
              <label className="flex min-w-0 items-center gap-2.5 text-[0.92rem] text-foreground">
                <input
                  type="radio"
                  name="cluster-open-mode"
                  checked={draft.general.clusterOpenMode === "dialog"}
                  onChange={() =>
                    setDraft((current) => ({
                      ...current,
                      general: {
                        ...current.general,
                        clusterOpenMode: "dialog",
                      },
                    }))
                  }
                />
                <span>Open with dialog</span>
              </label>
              <label className="flex min-w-0 items-center gap-2.5 text-[0.92rem] text-foreground">
                <input
                  type="radio"
                  name="cluster-open-mode"
                  checked={draft.general.clusterOpenMode === "page"}
                  onChange={() =>
                    setDraft((current) => ({
                      ...current,
                      general: { ...current.general, clusterOpenMode: "page" },
                    }))
                  }
                />
                <span>Open as page</span>
              </label>
            </fieldset>
          </div>

          <div className="flex flex-col gap-[14px] border-t border-border/90 py-4">
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-[0.98rem] font-medium text-foreground">
                Token Counter
              </p>
              <p className="text-[0.86rem] leading-[1.5] text-muted-foreground">
                Choose the built-in estimator used in document footer stats.
              </p>
            </div>
            <fieldset className="flex flex-col gap-2.5">
              <label className="flex min-w-0 items-center gap-2.5 text-[0.92rem] text-foreground">
                <input
                  type="radio"
                  name="token-counter-preset"
                  checked={draft.general.tokenCounterPreset === "chatgpt"}
                  onChange={() =>
                    setDraft((current) => ({
                      ...current,
                      general: {
                        ...current.general,
                        tokenCounterPreset: "chatgpt",
                      },
                    }))
                  }
                />
                <span>ChatGPT</span>
              </label>
              <label className="flex min-w-0 items-center gap-2.5 text-[0.92rem] text-foreground">
                <input
                  type="radio"
                  name="token-counter-preset"
                  checked={draft.general.tokenCounterPreset === "claude"}
                  onChange={() =>
                    setDraft((current) => ({
                      ...current,
                      general: {
                        ...current.general,
                        tokenCounterPreset: "claude",
                      },
                    }))
                  }
                />
                <span>Claude</span>
              </label>
            </fieldset>
          </div>

          <div className="flex flex-col gap-[14px] border-t border-border/90 py-4 lg:flex-row lg:items-center lg:justify-between lg:gap-7">
            <div className="flex min-w-0 flex-col gap-1 lg:basis-[17rem]">
              <p className="text-[0.98rem] font-medium text-foreground">
                Project Import Behavior
              </p>
              <p className="text-[0.86rem] leading-[1.5] text-muted-foreground">
                Allow duplicate local path as new project.
              </p>
            </div>
            <div className="flex items-center lg:flex-1 lg:justify-start">
              <label className="flex min-w-0 items-center gap-2.5 text-[0.92rem] text-foreground">
                <input
                  type="checkbox"
                  checked={draft.general.allowDuplicateLocalPathAsNewProject}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      general: {
                        ...current.general,
                        allowDuplicateLocalPathAsNewProject:
                          event.target.checked,
                      },
                    }))
                  }
                />
                <span>Enabled</span>
              </label>
            </div>
          </div>
        </div>
      </section>

      <Separator />

      <div className="flex flex-wrap justify-end gap-2 pt-[18px]">
        <Button
          variant="outline"
          onClick={() =>
            setDraft((current) => ({
              ...current,
              general: { ...DEFAULT_GENERAL_SETTINGS },
            }))
          }
          disabled={!hasGeneralChanges}
        >
          Reset
        </Button>
        <Button onClick={saveDraft} disabled={!hasGeneralChanges}>
          Save
        </Button>
      </div>
    </div>
  )
}
