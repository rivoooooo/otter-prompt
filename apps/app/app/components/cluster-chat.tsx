import { useMemo, useState } from "react"
import { PlusIcon, SendIcon } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { Textarea } from "@workspace/ui/components/textarea"
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

function createThread(provider: string, model: string, index: number): ClusterThread {
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

  const running = useMemo(() => threads.some((thread) => thread.running), [threads])

  async function streamThread(thread: ClusterThread, message: string, assistantId: string) {
    const response = await apiStream(
      "/chat/stream",
      {
        message,
        systemPrompt,
        provider: thread.provider,
        model: thread.model,
      },
      { apiKey },
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
                  : messageItem,
              ),
            }
          }),
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
            : candidate,
        ),
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
                        : messageItem,
                    ),
                  }
                : candidate,
            ),
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
                : candidate,
            ),
          )
        })
    })

    await Promise.all(pending)
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg">Cluster Test</h2>
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

      <div className="grid flex-1 gap-3 lg:grid-cols-2">
        {threads.map((thread) => (
          <Card key={thread.id} className="min-h-0">
            <CardHeader>
              <CardTitle>{thread.title}</CardTitle>
              <CardDescription>
                Compare output with independent provider and model settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  value={thread.provider}
                  onChange={(event) =>
                    setThreads((current) =>
                      current.map((candidate) =>
                        candidate.id === thread.id
                          ? { ...candidate, provider: event.target.value }
                          : candidate,
                      ),
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
                          : candidate,
                      ),
                    )
                  }
                  placeholder="Model"
                />
              </div>
              <ScrollArea className="h-[40svh] rounded-md border border-border px-3 py-2">
                <div className="flex flex-col gap-2 pb-4">
                  {thread.messages.length === 0 && (
                    <p className="text-sm text-muted-foreground">No messages yet.</p>
                  )}
                  {thread.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`max-w-[90%] rounded-md px-3 py-2 text-sm ${
                        message.role === "user"
                          ? "ml-auto bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      {message.content || (thread.running ? "..." : "")}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="sticky bottom-0 rounded-xl border border-border bg-background p-3 shadow-sm">
        <div className="flex flex-col gap-2">
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Send one message to all clusters"
            className="min-h-24"
          />
          <div className="flex justify-end">
            <Button onClick={() => send().catch(() => undefined)} disabled={running}>
              <SendIcon data-icon="inline-start" />
              Send to All
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
