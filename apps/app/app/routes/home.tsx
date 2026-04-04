import { useEffect, useMemo, useState, type KeyboardEvent } from "react"
import { useNavigate, useOutletContext } from "react-router"
import { ChevronDownIcon, SaveIcon, SendIcon, SparklesIcon } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
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
import { Input } from "@workspace/ui/components/input"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"
import { ClusterChat } from "../components/cluster-chat"
import { apiStream } from "../lib/api-client"
import {
  getAppSettings,
  getEffectiveProviderConfig,
  type AppSettings,
} from "../lib/app-settings"
import { estimateTokensForPreset } from "../lib/token-estimation"
import type { WorkspaceShellContext } from "./workspace"

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
}

type FileNameParts = {
  baseName: string
  extension: string
}

const SYSTEM_PROMPT_KEY = "otter.systemPrompt"
const nextId = () => Math.random().toString(36).slice(2)

function splitFileName(path: string): FileNameParts {
  const fileName = path.split(/[/\\]/).filter(Boolean).pop() || ""

  if (!fileName) {
    return {
      baseName: "",
      extension: "",
    }
  }

  const lastDotIndex = fileName.lastIndexOf(".")
  if (lastDotIndex <= 0) {
    return {
      baseName: fileName,
      extension: "",
    }
  }

  return {
    baseName: fileName.slice(0, lastDotIndex),
    extension: fileName.slice(lastDotIndex),
  }
}

function normalizeExtension(extension: string) {
  const trimmedExtension = extension.trim()
  if (!trimmedExtension) {
    return ""
  }

  return trimmedExtension.startsWith(".")
    ? trimmedExtension
    : `.${trimmedExtension}`
}

function buildRenamedFilePath(
  currentPath: string,
  baseName: string,
  extension: string
) {
  const nextFileName = `${baseName}${normalizeExtension(extension)}`
  const separatorIndex = Math.max(
    currentPath.lastIndexOf("/"),
    currentPath.lastIndexOf("\\")
  )

  if (separatorIndex < 0) {
    return nextFileName
  }

  return `${currentPath.slice(0, separatorIndex + 1)}${nextFileName}`
}

function getWordCount(text: string) {
  const matches = text.trim().match(/\S+/g)
  return matches?.length || 0
}

function getCharacterCount(text: string) {
  return Array.from(text).length
}

function getLineCount(text: string) {
  if (!text) {
    return 0
  }

  return text.split(/\r?\n/).length
}

function formatCount(value: number) {
  return new Intl.NumberFormat().format(value)
}

export default function Home() {
  const navigate = useNavigate()
  const {
    activeFile,
    fileContent,
    hasActiveFile,
    isFileDirty,
    syncStatus,
    setFileContent,
    setError,
    saveActiveFile,
    renameActiveFile,
    deleteActiveFile,
  } = useOutletContext<WorkspaceShellContext>()

  const [systemPrompt, setSystemPrompt] = useState("")
  const [chatInput, setChatInput] = useState("")
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [settings, setSettings] = useState<AppSettings>(getAppSettings())
  const [clusterOpen, setClusterOpen] = useState(false)
  const [chatRunning, setChatRunning] = useState(false)
  const [fileBaseName, setFileBaseName] = useState("")
  const [fileExtension, setFileExtension] = useState("")
  const [renameRunning, setRenameRunning] = useState(false)

  useEffect(() => {
    setSettings(getAppSettings())
    setSystemPrompt(window.localStorage.getItem(SYSTEM_PROMPT_KEY) || "")
  }, [])

  useEffect(() => {
    const nextParts = splitFileName(activeFile)
    setFileBaseName(nextParts.baseName)
    setFileExtension(nextParts.extension)
  }, [activeFile])

  const effectiveProvider = getEffectiveProviderConfig(settings)
  const contentStats = useMemo(
    () => ({
      characters: getCharacterCount(fileContent),
      words: getWordCount(fileContent),
      lines: getLineCount(fileContent),
      tokens: estimateTokensForPreset(
        fileContent,
        settings.general.tokenCounterPreset
      ),
    }),
    [fileContent, settings.general.tokenCounterPreset]
  )

  async function saveWorkspace() {
    window.localStorage.setItem(SYSTEM_PROMPT_KEY, systemPrompt)
    await saveActiveFile()
  }

  async function commitFileRename() {
    if (!hasActiveFile || renameRunning) {
      return
    }

    const nextBaseName = fileBaseName.trim()
    if (!nextBaseName) {
      setError("file name is required")
      return
    }

    const normalizedExtension = normalizeExtension(fileExtension)
    const nextPath = buildRenamedFilePath(
      activeFile,
      nextBaseName,
      normalizedExtension
    )

    setFileBaseName(nextBaseName)
    setFileExtension(normalizedExtension)

    if (nextPath === activeFile) {
      return
    }

    setRenameRunning(true)

    try {
      const renamedPath = await renameActiveFile(nextPath)
      const nextParts = splitFileName(renamedPath)
      setFileBaseName(nextParts.baseName)
      setFileExtension(nextParts.extension)
    } catch (cause) {
      setError(String(cause))
    } finally {
      setRenameRunning(false)
    }
  }

  function handleRenameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault()
      void commitFileRename()
      return
    }

    if (event.key === "Escape") {
      const nextParts = splitFileName(activeFile)
      setFileBaseName(nextParts.baseName)
      setFileExtension(nextParts.extension)
    }
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
          provider: effectiveProvider.providerId,
          model: effectiveProvider.defaultModel,
        },
        { apiKey: effectiveProvider.apiKey }
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
    if (settings.general.clusterOpenMode === "page") {
      navigate("/cluster")
      return
    }

    setClusterOpen(true)
  }

  return (
    <div className="app-main-grid">
      <main className="app-panel app-editor-panel">
        <div className="app-toolbar app-editor-toolbar">
          <div className="app-editor-heading">
            <p className="text-xs tracking-[0.12px] text-muted-foreground">
              File
            </p>
            <div className="app-editor-title-row">
              <Input
                value={fileBaseName}
                onChange={(event) => setFileBaseName(event.target.value)}
                onBlur={() => void commitFileRename()}
                onKeyDown={handleRenameKeyDown}
                placeholder="untitled"
                disabled={!hasActiveFile || renameRunning}
                className="app-editor-title-input"
              />
              <Input
                value={fileExtension}
                onChange={(event) => setFileExtension(event.target.value)}
                onBlur={() => void commitFileRename()}
                onKeyDown={handleRenameKeyDown}
                placeholder=".md"
                disabled={!hasActiveFile || renameRunning}
                className="app-editor-extension-input"
              />
            </div>
            <p className="app-editor-path">
              {activeFile || "No file available in this project."}
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

        <div className="app-editor-shell">
          <div className="app-editor-surface">
            <Textarea
              value={fileContent}
              onChange={(event) => setFileContent(event.target.value)}
              placeholder="No file available in this project."
              disabled={!hasActiveFile}
              className="app-editor-textarea font-mono"
            />
          </div>

          <div className="app-editor-footer">
            <div className="app-status-line app-editor-status-line">
              <span className="app-pill">
                {hasActiveFile
                  ? isFileDirty
                    ? "Status: Unsaved"
                    : "Status: Saved"
                  : "Status: No file"}
              </span>
              <span className="app-pill">
                Chars: {formatCount(contentStats.characters)}
              </span>
              <span className="app-pill">
                Words: {formatCount(contentStats.words)}
              </span>
              <span className="app-pill">
                Tokens: {formatCount(contentStats.tokens)}
              </span>
              <span className="app-pill">
                Lines: {formatCount(contentStats.lines)}
              </span>
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
          </div>
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
                <DropdownMenuItem onClick={() => setSystemPrompt("")}>
                  Clear Prompt
                </DropdownMenuItem>
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

        <div className="app-chat-settings">
          <p className="app-chat-settings-label">System Prompt</p>
          <Textarea
            value={systemPrompt}
            onChange={(event) => setSystemPrompt(event.target.value)}
            placeholder="Write system prompt here."
            className="min-h-28"
          />
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
              apiKey={effectiveProvider.apiKey}
              defaultProvider={effectiveProvider.providerId}
              defaultModel={effectiveProvider.defaultModel}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
