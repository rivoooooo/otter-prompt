import { useEffect, useMemo, useRef, useState } from "react"
import { useChat } from "@ai-sdk/react"
import {
  ChevronDownIcon,
  Settings2Icon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import type { ProviderModelRuntimeConfig } from "../lib/app-settings"
import { PlaygroundComposer } from "./playground/composer"
import { ChatTranscript } from "./playground/chat-ui"
import type { ComposerAttachment } from "./playground/utils"
import {
  buildUserMessageParts,
  createComposerAttachments,
  createPlaygroundTransport,
  getErrorMessage,
  isRunningStatus,
  releaseComposerAttachments,
  uploadComposerAttachments,
} from "./playground/utils"
import type { PlaygroundUIMessage } from "./playground/types"

type PlaygroundPanelProps = {
  projectId: string
  modelOptions: ProviderModelRuntimeConfig[]
  selectedModelKey: string
  selectedModel: ProviderModelRuntimeConfig | null
  mainPromptPath: string | null
  onSelectModelKey: (value: string) => void
  onOpenClusterTest: () => void
  onOpenSettings: () => void
  onError: (message: string) => void
}

type PlaygroundLayoutMode = "regular" | "compact"

export function PlaygroundPanel({
  projectId,
  modelOptions,
  selectedModelKey,
  selectedModel,
  mainPromptPath,
  onSelectModelKey,
  onOpenClusterTest,
  onOpenSettings,
  onError,
}: PlaygroundPanelProps) {
  const [input, setInput] = useState("")
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([])
  const [layoutMode, setLayoutMode] = useState<PlaygroundLayoutMode>("regular")
  const containerRef = useRef<HTMLDivElement | null>(null)
  const attachmentsRef = useRef(attachments)

  const transport = useMemo(
    () =>
      createPlaygroundTransport({
        providerId: selectedModel?.providerId || "",
        modelId: selectedModel?.modelId || "",
        projectId,
      }),
    [projectId, selectedModel?.modelId, selectedModel?.providerId]
  )

  const chat = useChat<PlaygroundUIMessage>({
    transport,
    onError(error) {
      onError(error.message)
    },
  })

  const running = isRunningStatus(chat.status)

  useEffect(() => {
    attachmentsRef.current = attachments
  }, [attachments])

  useEffect(
    () => () => {
      releaseComposerAttachments(attachmentsRef.current)
    },
    []
  )

  useEffect(() => {
    const node = containerRef.current
    if (!node || typeof ResizeObserver === "undefined") {
      return
    }

    const syncLayoutMode = () => {
      const width = node.clientWidth
      setLayoutMode(width < 560 ? "compact" : "regular")
    }

    syncLayoutMode()
    const observer = new ResizeObserver(syncLayoutMode)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  function removeAttachment(attachmentId: string) {
    setAttachments((current) => {
      const removed = current.find((attachment) => attachment.id === attachmentId)
      if (removed) {
        releaseComposerAttachments([removed])
      }

      return current.filter((attachment) => attachment.id !== attachmentId)
    })
  }

  function clearComposerState() {
    setInput("")
    setAttachments((current) => {
      releaseComposerAttachments(current)
      return []
    })
  }

  async function handleAddFiles(fileList: FileList | File[]) {
    try {
      const nextAttachments = await createComposerAttachments(fileList)
      setAttachments((current) => [...current, ...nextAttachments])
    } catch (error) {
      onError(getErrorMessage(error))
    }
  }

  async function handleSubmit({
    text,
    attachments: nextAttachments,
  }: {
    text: string
    attachments: ComposerAttachment[]
  }) {
    if (!selectedModel || running) {
      return
    }

    try {
      const parts = buildUserMessageParts(
        text,
        await uploadComposerAttachments(nextAttachments)
      )

      if (parts.length === 0) {
        return
      }

      await chat.sendMessage({ parts })
      clearComposerState()
    } catch (error) {
      onError(getErrorMessage(error))
    }
  }

  function clearConversation() {
    chat.stop()
    chat.setMessages([])
    chat.clearError()
    clearComposerState()
  }

  return (
    <div
      ref={containerRef}
      className="flex h-full min-h-0 min-w-0 w-full flex-1 flex-col bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.68),transparent_48%),linear-gradient(180deg,rgba(255,255,255,0.32),rgba(255,255,255,0))] dark:bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.06),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))]"
    >
      <div
        className={
          layoutMode === "compact"
            ? "flex w-full min-w-0 shrink-0 flex-wrap items-start justify-between gap-2 px-3 pb-3 pt-4"
            : "flex w-full min-w-0 shrink-0 items-center justify-between gap-3 px-6 pb-4 pt-6"
        }
      >
        <div className="min-w-0 flex-1 space-y-1">
          <h2
            className={
              layoutMode === "compact"
                ? "font-heading text-[1.32rem] leading-[1.15]"
                : "font-heading text-[1.55rem] leading-[1.15]"
            }
          >
            Playground
          </h2>
          <p className={layoutMode === "compact" ? "text-xs text-muted-foreground break-words" : "text-sm text-muted-foreground break-words"}>
            Stream markdown, render images, and test attachments against the selected runtime model.
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" className="shrink-0" />}
          >
            More
            <ChevronDownIcon data-icon="inline-end" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="rounded-[20px] border-border/90 bg-card/98">
            <DropdownMenuItem onClick={onOpenClusterTest}>
              <SparklesIcon data-icon="inline-start" />
              Cluster Test
            </DropdownMenuItem>
            <DropdownMenuItem onClick={clearConversation}>
              <Trash2Icon data-icon="inline-start" />
              Clear Conversation
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenSettings}>
              <Settings2Icon data-icon="inline-start" />
              Go to Settings
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div
        className={
          layoutMode === "compact"
            ? "w-full min-w-0 shrink-0 px-3 pb-3"
            : "w-full min-w-0 shrink-0 px-6 pb-5"
        }
      >
        <div
          className={
            layoutMode === "compact"
              ? "rounded-[20px] border border-border/90 bg-card/90 px-3 py-3 shadow-[0_8px_36px_rgba(20,20,19,0.05)]"
              : "rounded-[28px] border border-border/90 bg-card/90 px-5 py-4 shadow-[0_12px_60px_rgba(20,20,19,0.04)]"
          }
        >
          <div className="flex flex-wrap items-center gap-2 text-[0.76rem] uppercase tracking-[0.14em] text-muted-foreground">
            <span>System Prompt</span>
            <span className="h-px w-10 bg-border/80" />
            <span>{mainPromptPath ? "Injected from root main.md" : "No main.md found"}</span>
          </div>
          <p className={layoutMode === "compact" ? "mt-2 text-xs leading-[1.6] text-foreground break-all" : "mt-2 text-sm leading-[1.7] text-foreground break-all"}>
            {mainPromptPath ||
              "Create /main.md in the project root to define a stable system prompt for playground runs."}
          </p>
        </div>
      </div>

      <div
        className={
          layoutMode === "compact"
            ? "min-h-0 min-w-0 w-full flex-1 px-2 pb-2"
            : "min-h-0 min-w-0 w-full flex-1 px-4 pb-4"
        }
      >
        <div
          className={
            layoutMode === "compact"
              ? "flex h-full min-h-0 min-w-0 w-full flex-col rounded-[22px] border border-border/80 bg-[#faf9f5]/80 shadow-[0_14px_42px_rgba(20,20,19,0.08)] dark:bg-[#171715]/70"
              : "flex h-full min-h-0 min-w-0 w-full flex-col rounded-[32px] border border-border/80 bg-[#faf9f5]/80 shadow-[0_28px_90px_rgba(20,20,19,0.06)] dark:bg-[#171715]/70"
          }
        >
          <div className="min-h-0 flex-1">
            <ChatTranscript
              messages={chat.messages}
              status={chat.status}
              error={chat.error}
              emptyState={
                selectedModel
                  ? "Send a prompt, drop in a file, or paste an image to start the run."
                  : "Enable at least one provider model in Settings to start testing."
              }
              contentClassName={layoutMode === "compact" ? "pb-[13.5rem]" : "pb-[14rem]"}
              layoutMode={layoutMode}
              onRegenerate={
                selectedModel && chat.messages.length > 0
                  ? () => void chat.regenerate()
                  : undefined
              }
            />
          </div>

          <div
            className={
              layoutMode === "compact"
                ? "shrink-0 border-t border-border/80 bg-[linear-gradient(180deg,rgba(250,249,245,0),rgba(250,249,245,0.92)_18%,rgba(250,249,245,0.98)_100%)] px-3 pb-3 pt-3 dark:bg-[linear-gradient(180deg,rgba(23,23,21,0),rgba(23,23,21,0.92)_18%,rgba(23,23,21,0.98)_100%)]"
                : "shrink-0 border-t border-border/80 bg-[linear-gradient(180deg,rgba(250,249,245,0),rgba(250,249,245,0.92)_18%,rgba(250,249,245,0.98)_100%)] px-5 pb-5 pt-4 dark:bg-[linear-gradient(180deg,rgba(23,23,21,0),rgba(23,23,21,0.92)_18%,rgba(23,23,21,0.98)_100%)]"
            }
          >
            <PlaygroundComposer
              value={input}
              attachments={attachments}
              status={chat.status}
              layoutMode={layoutMode}
              disabled={!selectedModel}
              placeholder="Send a prompt, markdown, or files to the playground"
              hint={
                selectedModel
                  ? "Images stay visual, text files are injected as content, and other files are summarized for the model."
                  : "Configure and enable a provider model to start chatting."
              }
              modelOptions={modelOptions}
              selectedModelKey={selectedModelKey}
              selectedModel={selectedModel}
              onValueChange={setInput}
              onAddFiles={handleAddFiles}
              onRemoveAttachment={removeAttachment}
              onReset={clearComposerState}
              onSubmit={handleSubmit}
              onError={onError}
              onStop={() => chat.stop()}
              onSelectModelKey={onSelectModelKey}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
