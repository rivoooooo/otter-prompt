import { useMemo, useState } from "react"
import { PlusIcon, SendIcon } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { Separator } from "@workspace/ui/components/separator"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"
import { apiStream } from "../lib/api-client"

type ClusterMessage = {
  id: string
  role: "user" | "assistant"
  content: string
}

type ClusterThread = {
  id: string
  title: string
  provider: string
  model: string
  messages: ClusterMessage[]
  running: boolean
}

type ClusterChatProps = {
  systemPrompt: string
  apiKey: string
  defaultProvider: string
  defaultModel: string
}

const nextId = () => Math.random().toString(36).slice(2)

function createThread(
  provider: string,
  model: string,
  index: number
): ClusterThread {
  return {
    id: nextId(),
    title: `Cluster ${index}`,
    provider,
    model,
    messages: [],
    running: false,
  }
}

export function ClusterChat({
  systemPrompt,
  apiKey,
  defaultProvider,
  defaultModel,
}: ClusterChatProps) {
  const [input, setInput] = useState("")
  const [threads, setThreads] = useState<ClusterThread[]>([
    createThread(defaultProvider, defaultModel, 1),
  ])

  const running = useMemo(
    () => threads.some((thread) => thread.running),
    [threads]
  )

  async function streamThread(
    thread: ClusterThread,
    message: string,
    assistantId: string
  ) {
    const response = await apiStream(
      "/chat/stream",
      {
        message,
        systemPrompt,
        provider: thread.provider,
        model: thread.model,
      },
      { apiKey }
    )

    if (!response.ok || !response.body) {
      throw new Error(`chat stream failed for ${thread.title}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
      const { value, done } = await reader.read()
      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const events = buffer.split("\n\n")
      buffer = events.pop() || ""

      for (const event of events) {
        if (!event.startsWith("data: ")) {
          continue
        }

        const payload = JSON.parse(event.slice(6)) as { chunk?: string }
        if (!payload.chunk) {
          continue
        }

        setThreads((current) =>
          current.map((candidate) => {
            if (candidate.id !== thread.id) {
              return candidate
            }

            return {
              ...candidate,
              messages: candidate.messages.map((messageItem) =>
                messageItem.id === assistantId
                  ? {
                      ...messageItem,
                      content: messageItem.content + payload.chunk,
                    }
                  : messageItem
              ),
            }
          })
        )
      }
    }
  }

  async function send() {
    if (!input.trim() || running) {
      return
    }

    const userMessage = input
    setInput("")

    const pending = threads.map((thread) => {
      const userId = nextId()
      const assistantId = nextId()

      setThreads((current) =>
        current.map((candidate) =>
          candidate.id === thread.id
            ? {
                ...candidate,
                running: true,
                messages: [
                  ...candidate.messages,
                  { id: userId, role: "user", content: userMessage },
                  { id: assistantId, role: "assistant", content: "" },
                ],
              }
            : candidate
        )
      )

      return streamThread(thread, userMessage, assistantId)
        .catch((cause) => {
          setThreads((current) =>
            current.map((candidate) =>
              candidate.id === thread.id
                ? {
                    ...candidate,
                    messages: candidate.messages.map((messageItem) =>
                      messageItem.id === assistantId
                        ? {
                            ...messageItem,
                            content: `Error: ${String(cause)}`,
                          }
                        : messageItem
                    ),
                  }
                : candidate
            )
          )
        })
        .finally(() => {
          setThreads((current) =>
            current.map((candidate) =>
              candidate.id === thread.id
                ? {
                    ...candidate,
                    running: false,
                  }
                : candidate
            )
          )
        })
    })

    await Promise.all(pending)
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="app-chat-title font-heading text-lg">Cluster Test</h2>
          <p className="text-sm text-[#b0aea5]">
            Compare multiple provider/model runs side by side.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() =>
            setThreads((current) => [
              ...current,
              createThread(defaultProvider, defaultModel, current.length + 1),
            ])
          }
        >
          <PlusIcon data-icon="inline-start" />
          Add Cluster
        </Button>
      </div>

      <Separator className="bg-[#30302e]" />

      <div className="grid flex-1 gap-6 lg:grid-cols-2">
        {threads.map((thread) => (
          <section
            key={thread.id}
            className="flex min-h-0 flex-col gap-3 border-t border-[#30302e] pt-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-heading text-xl leading-[1.15]">
                  {thread.title}
                </h3>
                <p className="text-sm text-[#b0aea5]">
                  Compare output with independent provider and model settings.
                </p>
              </div>
              <span className="app-pill border-[#3d3d3a] bg-[#1c1c1b] text-[#b0aea5]">
                {thread.running ? "Running" : "Idle"}
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Input
                value={thread.provider}
                onChange={(event) =>
                  setThreads((current) =>
                    current.map((candidate) =>
                      candidate.id === thread.id
                        ? { ...candidate, provider: event.target.value }
                        : candidate
                    )
                  )
                }
                placeholder="Provider"
              />
              <Input
                value={thread.model}
                onChange={(event) =>
                  setThreads((current) =>
                    current.map((candidate) =>
                      candidate.id === thread.id
                        ? { ...candidate, model: event.target.value }
                        : candidate
                    )
                  )
                }
                placeholder="Model"
              />
            </div>

            <Separator className="bg-[#30302e]" />

            <ScrollArea className="min-h-0 flex-1">
              <div className="flex flex-col gap-2 pr-4 pb-4">
                {thread.messages.length === 0 && (
                  <p className="text-sm text-[#87867f]">No messages yet.</p>
                )}
                {thread.messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "max-w-[92%] rounded-2xl px-3 py-2 text-sm",
                      message.role === "user"
                        ? "ml-auto bg-[#c96442] text-[#faf9f5]"
                        : "border border-[#3d3d3a] bg-[#1c1c1b] text-[#faf9f5]"
                    )}
                  >
                    {message.content || (thread.running ? "..." : "")}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </section>
        ))}
      </div>

      <div className="app-composer app-composer--dark sticky bottom-0">
        <div className="flex flex-col gap-2">
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Send one message to all clusters"
            className="app-dark-textarea min-h-24"
          />
          <div className="flex justify-end">
            <Button
              onClick={() => send().catch(() => undefined)}
              disabled={running}
            >
              <SendIcon data-icon="inline-start" />
              Send to All
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
