import { useNavigate, useOutletContext } from "react-router"
import { useEffect, useState } from "react"
import { ChevronDownIcon, SaveIcon, SendIcon, SparklesIcon } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"
import { ClusterChat } from "../components/cluster-chat"
import { apiStream } from "../lib/api-client"
import { getAppSettings, type AppSettings } from "../lib/app-settings"
import type { WorkspaceShellContext } from "./workspace"

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
}

const SYSTEM_PROMPT_KEY = "otter.systemPrompt"
const nextId = () => Math.random().toString(36).slice(2)

export default function Home() {
  const navigate = useNavigate()
  const {
    activeFile,
    fileContent,
    hasActiveFile,
    syncStatus,
    setFileContent,
    setError,
    saveActiveFile,
    deleteActiveFile,
  } = useOutletContext<WorkspaceShellContext>()

  const [systemPrompt, setSystemPrompt] = useState("")
  const [chatInput, setChatInput] = useState("")
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [settings, setSettings] = useState<AppSettings>(getAppSettings())
  const [promptOpen, setPromptOpen] = useState(true)
  const [fileOpen, setFileOpen] = useState(true)
  const [clusterOpen, setClusterOpen] = useState(false)
  const [chatRunning, setChatRunning] = useState(false)

  useEffect(() => {
    setSettings(getAppSettings())
    setSystemPrompt(window.localStorage.getItem(SYSTEM_PROMPT_KEY) || "")
  }, [])

  async function saveWorkspace() {
    window.localStorage.setItem(SYSTEM_PROMPT_KEY, systemPrompt)
    await saveActiveFile()
  }

  async function runChat() {
    if (!chatInput.trim() || chatRunning) {
      return
    }

    const userMessage = chatInput
    const assistantId = nextId()

    setChatRunning(true)
    setChatInput("")
    setChatMessages((current) => [
      ...current,
      { id: nextId(), role: "user", content: userMessage },
      { id: assistantId, role: "assistant", content: "" },
    ])

    try {
      const response = await apiStream(
        "/chat/stream",
        {
          message: userMessage,
          systemPrompt,
          provider: settings.provider,
          model: settings.defaultModel,
        },
        { apiKey: settings.apiKey }
      )

      if (!response.ok || !response.body) {
        throw new Error("failed to run chat stream")
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

          setChatMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? { ...message, content: message.content + payload.chunk }
                : message
            )
          )
        }
      }
    } catch (cause) {
      setChatMessages((current) =>
        current.map((message) =>
          message.id === assistantId
            ? { ...message, content: `Error: ${String(cause)}` }
            : message
        )
      )
    } finally {
      setChatRunning(false)
    }
  }

  function openClusterTest() {
    if (settings.clusterOpenMode === "page") {
      navigate("/cluster")
      return
    }

    setClusterOpen(true)
  }

  return (
    <div className="app-main-grid">
      <main className="app-panel flex min-h-0 flex-col">
        <div className="app-toolbar">
          <div>
            <p className="text-xs tracking-[0.12px] text-muted-foreground">
              Workspace
            </p>
            <h1 className="font-heading text-[1.75rem] leading-[1.2]">
              Prompt Editor
            </h1>
            <p className="text-sm text-muted-foreground">
              {activeFile || "No file selected"}
            </p>
          </div>
          <div className="app-toolbar-actions">
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" />}>
                Actions
                <ChevronDownIcon data-icon="inline-end" />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => setSystemPrompt("")}>
                    Clear Prompt
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      deleteActiveFile().catch((cause) =>
                        setError(String(cause))
                      )
                    }
                    disabled={!hasActiveFile}
                  >
                    Delete Active File
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              onClick={() =>
                saveWorkspace().catch((cause) => setError(String(cause)))
              }
            >
              <SaveIcon data-icon="inline-start" />
              Save
            </Button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <Collapsible open={promptOpen} onOpenChange={setPromptOpen}>
            <div className="app-section-card">
              <CollapsibleTrigger
                render={
                  <button className="flex w-full items-center justify-between px-3 py-2 text-left" />
                }
              >
                <span className="font-medium">System Prompt</span>
                <ChevronDownIcon
                  className={`transition ${promptOpen ? "rotate-180" : ""}`}
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="p-3 pt-0">
                  <Textarea
                    value={systemPrompt}
                    onChange={(event) => setSystemPrompt(event.target.value)}
                    placeholder="Write system prompt here."
                    className="min-h-[35svh]"
                  />
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          <Collapsible open={fileOpen} onOpenChange={setFileOpen}>
            <div className="app-section-card">
              <CollapsibleTrigger
                render={
                  <button className="flex w-full items-center justify-between px-3 py-2 text-left" />
                }
              >
                <span className="font-medium">Active File Content</span>
                <ChevronDownIcon
                  className={`transition ${fileOpen ? "rotate-180" : ""}`}
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="p-3 pt-0">
                  <Textarea
                    value={fileContent}
                    onChange={(event) => setFileContent(event.target.value)}
                    placeholder="Select a file from the left tree."
                    className="min-h-[22svh] font-mono"
                  />
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        </div>

        <div className="app-status-line flex flex-wrap gap-2">
          <span className="app-pill">
            Last sync: {syncStatus?.local?.lastSyncedAt || "never"}
          </span>
          <span className="app-pill">
            Cloud rev: {syncStatus?.cloud?.revision ?? 0}
          </span>
          <span className="app-pill">
            Conflicts: {syncStatus?.local?.conflicts?.length || 0}
          </span>
        </div>
      </main>

      <section className="app-panel app-section-card flex min-h-0 flex-col">
        <div className="app-toolbar">
          <div>
            <p className="text-xs tracking-[0.12px] text-muted-foreground">
              Conversation
            </p>
            <h2 className="font-heading text-[1.45rem] leading-[1.2]">
              Chat Test
            </h2>
            <p className="text-sm text-muted-foreground">Single conversation</p>
          </div>
          <div className="app-toolbar-actions">
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" />}>
                More
                <ChevronDownIcon data-icon="inline-end" />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setChatMessages([])}>
                  Clear Conversation
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/settings")}>
                  Go to Settings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" onClick={openClusterTest}>
              <SparklesIcon data-icon="inline-start" />
              Cluster Test
            </Button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <ScrollArea className="app-chat-log min-h-0 flex-1">
            <div className="flex flex-col gap-2 pb-4">
              {chatMessages.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Start a chat to test your prompt.
                </p>
              )}
              {chatMessages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "max-w-[90%] rounded-md px-3 py-2 text-sm",
                    message.role === "user"
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  )}
                >
                  {message.content || (chatRunning ? "..." : "")}
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="app-composer">
            <div className="flex flex-col gap-2">
              <Textarea
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder="Send message for single chat test"
                className="min-h-24"
              />
              <div className="flex justify-end">
                <Button
                  onClick={() =>
                    runChat().catch((cause) => setError(String(cause)))
                  }
                  disabled={chatRunning}
                >
                  <SendIcon data-icon="inline-start" />
                  Send
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Dialog open={clusterOpen} onOpenChange={setClusterOpen}>
        <DialogContent className="max-w-[95vw]">
          <DialogHeader>
            <DialogTitle>Cluster Test</DialogTitle>
          </DialogHeader>
          <div className="h-[80svh]">
            <ClusterChat
              systemPrompt={systemPrompt}
              apiKey={settings.apiKey}
              defaultProvider={settings.provider}
              defaultModel={settings.defaultModel}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
