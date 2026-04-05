import { CheckIcon, ChevronsUpDownIcon } from "lucide-react"
import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import type { ProviderModelRuntimeConfig } from "../../lib/app-settings"
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorName,
  ModelSelectorSeparator,
  ModelSelectorTrigger,
} from "../../../components/ai-elements/model-selector"

type PlaygroundModelPickerProps = {
  modelOptions: ProviderModelRuntimeConfig[]
  selectedModelKey: string
  selectedModel: ProviderModelRuntimeConfig | null
  onSelectModelKey: (value: string) => void
  layoutMode?: "regular" | "compact"
  className?: string
}

function groupModelOptions(modelOptions: ProviderModelRuntimeConfig[]) {
  const groups = new Map<string, ProviderModelRuntimeConfig[]>()

  for (const option of modelOptions) {
    const group = groups.get(option.providerLabel) || []
    group.push(option)
    groups.set(option.providerLabel, group)
  }

  return [...groups.entries()]
}

export function PlaygroundModelPicker({
  modelOptions,
  selectedModelKey,
  selectedModel,
  onSelectModelKey,
  layoutMode = "regular",
  className,
}: PlaygroundModelPickerProps) {
  const groups = groupModelOptions(modelOptions)
  const [open, setOpen] = useState(false)

  return (
    <ModelSelector
      open={open}
      onOpenChange={setOpen}
    >
      <ModelSelectorTrigger
        render={
          <Button
            variant="outline"
            className={cn(
              layoutMode === "compact"
                ? "h-8 w-full min-w-0 justify-between rounded-full border-border/80 bg-card/90 px-2.5 text-left shadow-none"
                : "h-9 w-full min-w-0 justify-between rounded-full border-border/80 bg-card/90 px-3 text-left shadow-none",
              className
            )}
            disabled={modelOptions.length === 0}
          />
        }
      >
        <span className="flex min-w-0 items-center gap-2">
          {selectedModel ? (
            <ModelSelectorLogo
              provider={selectedModel.providerId.toLowerCase()}
              className="size-3.5"
            />
          ) : null}
          <span className={layoutMode === "compact" ? "min-w-0 truncate text-xs" : "min-w-0 truncate text-sm"}>
            {selectedModel
              ? `${selectedModel.providerLabel} / ${selectedModel.modelLabel}`
              : "No enabled models"}
          </span>
        </span>
        <ChevronsUpDownIcon className="size-4 text-muted-foreground" />
      </ModelSelectorTrigger>

      <ModelSelectorContent className="min-w-md w-[min(var(--radix-popover-trigger-width),calc(100vw-2rem))] max-w-[calc(100vw-2rem)] rounded-[28px] border border-border/90 bg-card/98 p-0 shadow-[0_24px_80px_rgba(20,20,19,0.12)]">
        <ModelSelectorInput placeholder="Search models" />
        <ModelSelectorList className="max-h-[24rem]">
          <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
          {groups.map(([providerLabel, options], index) => (
            <div key={providerLabel}>
              {index > 0 ? <ModelSelectorSeparator /> : null}
              <ModelSelectorGroup heading={providerLabel}>
                {options.map((option) => {
                  const selected = option.key === selectedModelKey

                  return (
                    <ModelSelectorItem
                      key={option.key}
                      value={`${option.providerLabel} ${option.modelLabel} ${option.modelId}`}
                      onSelect={() => {
                        onSelectModelKey(option.key)
                        setOpen(false)
                      }}
                      className="gap-2"
                    >
                      <ModelSelectorLogo
                        provider={option.providerId.toLowerCase()}
                        className="size-3.5"
                      />
                      <ModelSelectorName className="flex flex-col gap-0.5">
                        <span className="truncate text-sm text-foreground">
                          {option.modelLabel}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {option.modelId}
                        </span>
                      </ModelSelectorName>
                      <CheckIcon
                        className={cn(
                          "ml-auto size-4",
                          selected ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </ModelSelectorItem>
                  )
                })}
              </ModelSelectorGroup>
            </div>
          ))}
        </ModelSelectorList>
      </ModelSelectorContent>
    </ModelSelector>
  )
}
