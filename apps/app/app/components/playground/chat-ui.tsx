import { CopyIcon, MessageSquareTextIcon, RotateCcwIcon } from "lucide-react"
import {
  Attachment,
  AttachmentInfo,
  AttachmentPreview,
  Attachments,
} from "../../../components/ai-elements/attachments"
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "../../../components/ai-elements/conversation"
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
  MessageToolbar,
} from "../../../components/ai-elements/message"
import type { PlaygroundUIMessage } from "./types"
import {
  getMessageAttachments,
  getMessageText,
  isStreamingMessage,
} from "./utils"

type ChatTranscriptProps = {
  messages: PlaygroundUIMessage[]
  status: string
  emptyState: string
  error?: Error
  layoutMode?: "regular" | "compact"
  className?: string
  contentClassName?: string
  emptyClassName?: string
  onRegenerate?: () => void
}

async function copyText(text: string) {
  if (!text) {
    return
  }

  await navigator.clipboard.writeText(text)
}

export function ChatTranscript({
  messages,
  status,
  emptyState,
  error,
  layoutMode = "regular",
  className,
  contentClassName,
  emptyClassName,
  onRegenerate,
}: ChatTranscriptProps) {
  return (
    <Conversation className={className}>
      <ConversationContent
        className={`${layoutMode === "compact" ? "px-3 pt-4" : "px-5 pt-6"} ${contentClassName || ""}`.trim()}
      >
        {messages.length === 0 ? (
          <ConversationEmptyState
            className={emptyClassName}
            icon={<MessageSquareTextIcon className="size-5" />}
            title="Playground conversation"
            description={emptyState}
          />
        ) : null}

        {messages.map((message, index) => {
          const text = getMessageText(message)
          const attachments = getMessageAttachments(message)
          const isAssistant = message.role === "assistant"
          const canCopy = text.trim().length > 0
          const showStreamingPlaceholder =
            isAssistant &&
            attachments.length === 0 &&
            !text &&
            (status === "submitted" || status === "streaming")

          return (
            <Message
              key={message.id}
              from={message.role}
              className={
                layoutMode === "compact"
                  ? "w-full max-w-full"
                  : isAssistant
                    ? "w-full max-w-full"
                    : "w-full max-w-full"
              }
            >
              <div className="mb-1 flex items-center gap-2 px-1 text-[0.72rem] uppercase tracking-[0.16em] text-muted-foreground">
                <span>{isAssistant ? "Assistant" : "Prompt"}</span>
                <span className="h-px flex-1 bg-border/70" />
              </div>

              <MessageContent
                className={
                  isAssistant
                    ? layoutMode === "compact"
                      ? "w-full rounded-[18px] border border-border/80 bg-card px-3 py-3 shadow-[0_10px_32px_rgba(20,20,19,0.08)]"
                      : "w-full rounded-[26px] border border-border/80 bg-card px-5 py-4 shadow-[0_12px_50px_rgba(20,20,19,0.05)]"
                    : layoutMode === "compact"
                      ? "w-full rounded-[18px] bg-[#e8e6dc] px-3 py-3 text-[#30302e] shadow-none dark:bg-[#2e2d2a] dark:text-[#faf9f5]"
                      : "w-full rounded-[26px] bg-[#e8e6dc] px-5 py-4 text-[#30302e] shadow-none dark:bg-[#2e2d2a] dark:text-[#faf9f5]"
                }
              >
                {attachments.length > 0 ? (
                  <Attachments
                    variant="list"
                    className={text ? "mb-4 w-full" : "w-full"}
                  >
                    {attachments.map((attachment) => (
                      <Attachment
                        key={attachment.id}
                        data={attachment}
                        className="w-full rounded-[20px] border-border/80 bg-background/80"
                      >
                        <AttachmentPreview />
                        <AttachmentInfo showMediaType />
                      </Attachment>
                    ))}
                  </Attachments>
                ) : null}

                {text ? (
                  <MessageResponse
                    isAnimating={isAssistant && isStreamingMessage(message)}
                    className={
                      layoutMode === "compact"
                        ? "prose prose-sm max-w-none text-[0.9rem] leading-[1.65] text-inherit prose-headings:font-heading prose-headings:text-inherit prose-p:text-inherit prose-pre:rounded-[14px] prose-pre:border prose-pre:border-border/80 prose-pre:bg-background/80 prose-code:text-inherit prose-strong:text-inherit"
                        : "prose prose-sm max-w-none text-[0.98rem] leading-[1.7] text-inherit prose-headings:font-heading prose-headings:text-inherit prose-p:text-inherit prose-pre:rounded-[18px] prose-pre:border prose-pre:border-border/80 prose-pre:bg-background/80 prose-code:text-inherit prose-strong:text-inherit"
                    }
                  >
                    {text}
                  </MessageResponse>
                ) : null}

                {showStreamingPlaceholder ? (
                  <p className="text-sm text-muted-foreground">Thinking…</p>
                ) : null}
              </MessageContent>

              {isAssistant && (canCopy || onRegenerate) ? (
                <MessageToolbar
                  className={
                    layoutMode === "compact" ? "mt-1 px-0" : "mt-1 px-1"
                  }
                >
                  <div className="text-xs text-muted-foreground">
                    Response {index + 1}
                  </div>
                  <MessageActions>
                    {canCopy ? (
                      <MessageAction
                        tooltip="Copy response"
                        label="Copy response"
                        onClick={() => void copyText(text)}
                      >
                        <CopyIcon className="size-4" />
                      </MessageAction>
                    ) : null}
                    {onRegenerate ? (
                      <MessageAction
                        tooltip="Retry response"
                        label="Retry response"
                        onClick={onRegenerate}
                      >
                        <RotateCcwIcon className="size-4" />
                      </MessageAction>
                    ) : null}
                  </MessageActions>
                </MessageToolbar>
              ) : null}
            </Message>
          )
        })}

        {error ? (
          <Message from="assistant" className="w-full max-w-full">
            <div className="rounded-[24px] border border-[#ddb7aa] bg-[#fff3ef] px-5 py-4 text-sm leading-[1.6] text-[#8a3c24] dark:border-[#5b382d] dark:bg-[#2d211d] dark:text-[#f2c7b9]">
              {error.message}
            </div>
          </Message>
        ) : null}
      </ConversationContent>

      <ConversationScrollButton className="bottom-5" />
    </Conversation>
  )
}
