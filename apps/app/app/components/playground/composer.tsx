import {
  PaperclipIcon,
  RotateCcwIcon,
  ScanLineIcon,
  SparklesIcon,
} from "lucide-react"
import type { ChatStatus } from "ai"
import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react"
import { InputGroupTextarea } from "@workspace/ui/components/input-group"
import { cn } from "@workspace/ui/lib/utils"
import type { ProviderModelRuntimeConfig } from "../../lib/app-settings"
import {
  Attachment,
  AttachmentInfo,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "../../../components/ai-elements/attachments"
import {
  PromptInput,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuItem,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTools,
} from "../../../components/ai-elements/prompt-input"
import { isRunningStatus, type ComposerAttachment } from "./utils"
import { PlaygroundModelPicker } from "./model-picker"

type ComposerSubmission = {
  text: string
  attachments: ComposerAttachment[]
}

type PlaygroundComposerProps = {
  value: string
  attachments: ComposerAttachment[]
  status: ChatStatus
  layoutMode?: "regular" | "compact"
  disabled?: boolean
  placeholder: string
  hint?: string
  modelOptions?: ProviderModelRuntimeConfig[]
  selectedModelKey?: string
  selectedModel?: ProviderModelRuntimeConfig | null
  onValueChange: (value: string) => void
  onAddFiles: (files: FileList | File[]) => Promise<void> | void
  onRemoveAttachment: (attachmentId: string) => void
  onReset: () => void
  onSubmit: (submission: ComposerSubmission) => Promise<void>
  onError: (message: string) => void
  onStop?: () => void
  onSelectModelKey?: (value: string) => void
}

async function captureScreenshotFile() {
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices?.getDisplayMedia
  ) {
    throw new Error("Screen capture is not available in this browser.")
  }

  let stream: MediaStream | null = null

  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      audio: false,
      video: true,
    })

    const video = document.createElement("video")
    video.srcObject = stream
    video.muted = true
    video.playsInline = true

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve()
      video.onerror = () => reject(new Error("Failed to load screen stream"))
    })

    await video.play()

    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const context = canvas.getContext("2d")
    if (!context) {
      throw new Error("Failed to capture screenshot.")
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/png")
    })

    if (!blob) {
      throw new Error("Failed to capture screenshot.")
    }

    const timestamp = new Date()
      .toISOString()
      .replaceAll(/[:.]/g, "-")
      .replace("T", "_")
      .replace("Z", "")

    return new File([blob], `screenshot-${timestamp}.png`, {
      type: "image/png",
      lastModified: Date.now(),
    })
  } finally {
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop()
      }
    }
  }
}

export function PlaygroundComposer({
  value,
  attachments,
  status,
  layoutMode = "regular",
  disabled = false,
  placeholder,
  hint,
  modelOptions = [],
  selectedModelKey = "",
  selectedModel = null,
  onValueChange,
  onAddFiles,
  onRemoveAttachment,
  onReset,
  onSubmit,
  onError,
  onStop,
  onSelectModelKey,
}: PlaygroundComposerProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isComposing, setIsComposing] = useState(false)
  const running = isRunningStatus(status)
  const canSend = !disabled && (value.trim().length > 0 || attachments.length > 0)
  const submitStatus: ChatStatus = onStop ? status : "ready"
  const submitDisabled = !canSend || (running && !onStop)

  function addFiles(files: FileList | File[]) {
    return Promise.resolve(onAddFiles(files)).catch((error: unknown) => {
      onError(error instanceof Error ? error.message : String(error))
    })
  }

  async function handleCaptureScreenshot() {
    try {
      const file = await captureScreenshotFile()
      await addFiles([file])
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error))
    }
  }

  async function handlePromptSubmit({ text }: { text: string }) {
    await onSubmit({
      text,
      attachments,
    })
  }

  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || isComposing) {
      return
    }

    event.preventDefault()
    event.currentTarget.form?.requestSubmit()
  }

  function handleTextareaPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files: File[] = []

    for (const item of event.clipboardData.items) {
      if (item.kind === "file") {
        const file = item.getAsFile()
        if (file) {
          files.push(file)
        }
      }
    }

    if (files.length === 0) {
      return
    }

    event.preventDefault()
    void addFiles(files)
  }

  return (
    <div
      className={cn(
        "relative w-full min-w-0 rounded-[30px] border border-border/90 bg-card/95 shadow-[0_20px_70px_rgba(20,20,19,0.08)] transition-all",
        isDragOver &&
          "border-[#c96442] bg-[#faf3ef] shadow-[0_24px_80px_rgba(201,100,66,0.12)] dark:bg-[#2f2622]"
      )}
      onDragEnter={(event) => {
        if (event.dataTransfer.types.includes("Files")) {
          setIsDragOver(true)
        }
      }}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) {
          event.preventDefault()
        }
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
          return
        }

        setIsDragOver(false)
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.types.includes("Files")) {
          return
        }

        event.preventDefault()
        setIsDragOver(false)
        void addFiles(event.dataTransfer.files)
      }}
    >
      <PromptInput
        onSubmit={handlePromptSubmit}
        className="w-full"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            if (!event.target.files || event.target.files.length === 0) {
              return
            }

            void addFiles(event.target.files)
            event.target.value = ""
          }}
        />

        {attachments.length > 0 ? (
          <PromptInputHeader className="gap-2 border-b border-border/80 pb-0">
            <Attachments
              variant="inline"
              className={
                layoutMode === "compact"
                  ? "w-full flex-wrap gap-1.5 overflow-visible pb-2"
                  : "w-full gap-2 overflow-x-auto pb-2"
              }
            >
              {attachments.map((attachment) => (
                <Attachment
                  key={attachment.id}
                  data={attachment.preview}
                  onRemove={() => onRemoveAttachment(attachment.id)}
                  className={
                    layoutMode === "compact"
                      ? "max-w-full rounded-full border-border/80 bg-background/90 pr-1"
                      : "max-w-full shrink-0 rounded-full border-border/80 bg-background/90 pr-1"
                  }
                >
                  <AttachmentPreview />
                  <AttachmentInfo />
                  <AttachmentRemove />
                </Attachment>
              ))}
            </Attachments>
          </PromptInputHeader>
        ) : null}

        <PromptInputBody>
          <InputGroupTextarea
            value={value}
            name="message"
            placeholder={placeholder}
            disabled={disabled}
            className={
              layoutMode === "compact"
                ? "min-h-[96px] max-h-[220px] resize-none px-3 py-3 text-[0.9rem] leading-[1.55] placeholder:text-muted-foreground/80"
                : "min-h-[116px] max-h-[260px] resize-none px-4 py-4 text-[0.98rem] leading-[1.65] placeholder:text-muted-foreground/80"
            }
            onChange={(event) => onValueChange(event.target.value)}
            onCompositionEnd={() => setIsComposing(false)}
            onCompositionStart={() => setIsComposing(true)}
            onKeyDown={handleTextareaKeyDown}
            onPaste={handleTextareaPaste}
          />
        </PromptInputBody>

        <PromptInputFooter
          className={
            layoutMode === "compact"
              ? "border-t border-border/80 pt-2.5"
              : "border-t border-border/80 pt-3"
          }
        >
          <PromptInputTools
            className={
              layoutMode === "compact"
                ? "min-w-0 flex-wrap gap-1.5"
                : "min-w-0 flex-wrap gap-2"
            }
          >
            <PromptInputActionMenu>
              <PromptInputActionMenuTrigger
                variant="outline"
                tooltip="Add files or a screenshot"
                className="rounded-full border-border/80 bg-background/90"
              />
              <PromptInputActionMenuContent className="rounded-[20px] border-border/90 bg-card/98">
                <PromptInputActionMenuItem
                  onClick={() => fileInputRef.current?.click()}
                >
                  <PaperclipIcon className="size-4" />
                  Add attachments
                </PromptInputActionMenuItem>
                <PromptInputActionMenuItem onClick={() => void handleCaptureScreenshot()}>
                  <ScanLineIcon className="size-4" />
                  Capture screenshot
                </PromptInputActionMenuItem>
              </PromptInputActionMenuContent>
            </PromptInputActionMenu>

            {hint ? (
              <div
                className={
                  layoutMode === "compact"
                    ? "flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-[11px] text-muted-foreground"
                    : "flex min-w-0 items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-xs text-muted-foreground"
                }
              >
                <SparklesIcon className="size-3.5 shrink-0 text-[#c96442]" />
                <span className="truncate">{hint}</span>
              </div>
            ) : null}
          </PromptInputTools>

          <PromptInputTools
            className={
              layoutMode === "compact"
                ? "w-full flex-wrap items-center justify-between gap-1.5"
                : "w-full flex-wrap items-center justify-end gap-2"
            }
          >
            {onSelectModelKey ? (
              <PlaygroundModelPicker
                modelOptions={modelOptions}
                selectedModelKey={selectedModelKey}
                selectedModel={selectedModel}
                onSelectModelKey={onSelectModelKey}
                layoutMode={layoutMode}
                className="w-full min-w-0"
              />
            ) : null}

            <button
              type="button"
              onClick={onReset}
              disabled={disabled || (!value && attachments.length === 0)}
              className={
                layoutMode === "compact"
                  ? "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-border/80 bg-background/90 px-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                  : "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-border/80 bg-background/90 px-3 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
              }
            >
              <RotateCcwIcon className="size-4" />
              Reset
            </button>

            <PromptInputSubmit
              status={submitStatus}
              onStop={onStop}
              disabled={submitDisabled}
              className="h-10 w-10 rounded-full bg-[#c96442] text-white shadow-none hover:bg-[#b85a39] disabled:bg-muted disabled:text-muted-foreground"
            />
          </PromptInputTools>
        </PromptInputFooter>
      </PromptInput>

      {isDragOver ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[30px] border border-dashed border-[#c96442]/70 bg-[#f5f4ed]/80 text-sm text-[#7d4a35] backdrop-blur-[2px] dark:bg-[#141413]/80 dark:text-[#efdfd7]">
          Drop files to attach them to the next message
        </div>
      ) : null}
    </div>
  )
}
