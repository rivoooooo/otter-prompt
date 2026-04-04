import { useEffect, useMemo, useState, type KeyboardEvent } from "react"
import { useNavigate, useOutletContext } from "react-router"
import {
  ChevronDownIcon,
  FolderOpenIcon,
  MessageSquareIcon,
  SaveIcon,
  SendIcon,
  SparklesIcon,
} from "lucide-react"
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
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@workspace/ui/components/resizable"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { Separator } from "@workspace/ui/components/separator"
import { Textarea } from "@workspace/ui/components/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"
import { ClusterChat } from "../components/cluster-chat"
import { ProjectFileExplorer } from "../components/project-file-explorer"
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

type RightPanelView = "chat" | "files"

type FileNameParts = {
  baseName: string
  extension: string
}

const DEFAULT_SYSTEM_PROMPT = ""
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
    activeProject,
    tree,
    activeFile,
    fileContent,
    hasActiveFile,
    isFileDirty,
    syncStatus,
    setFileContent,
    setError,
    openFile,
    refreshTree,
    saveActiveFile,
    renameActiveFile,
    deleteActiveFile,
    renameWorkspacePath,
    deleteWorkspacePath,
  } = useOutletContext<WorkspaceShellContext>()

  const [chatInput, setChatInput] = useState("")
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [settings, setSettings] = useState<AppSettings>(getAppSettings())
  const [clusterOpen, setClusterOpen] = useState(false)
  const [chatRunning, setChatRunning] = useState(false)
  const [rightPanelView, setRightPanelView] = useState<RightPanelView>("chat")
  const [fileBaseName, setFileBaseName] = useState("")
  const [fileExtension, setFileExtension] = useState("")
  const [isDesktopLayout, setIsDesktopLayout] = useState(false)
  const [renameRunning, setRenameRunning] = useState(false)
  const systemPrompt = DEFAULT_SYSTEM_PROMPT

  useEffect(() => {
    setSettings(getAppSettings())
  }, [])

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)")
    const syncLayout = () => setIsDesktopLayout(mediaQuery.matches)

    syncLayout()
    mediaQuery.addEventListener("change", syncLayout)

    return () => mediaQuery.removeEventListener("change", syncLayout)
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
    <>
      <ResizablePanelGroup
        direction={isDesktopLayout ? "horizontal" : "vertical"}
        className="app-main-grid"
      >
        <ResizablePanel defaultSize={isDesktopLayout ? 58 : 60} minSize={35}>
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
        </ResizablePanel>

        <ResizableHandle className="app-workspace-handle" />

        <ResizablePanel defaultSize={isDesktopLayout ? 42 : 40} minSize={25}>
          <section className="app-panel app-module-panel">
            <div
              className={cn(
                "app-module-viewport",
                rightPanelView === "chat" && "app-module-viewport--chat"
              )}
            >
              {rightPanelView === "chat" ? (
                <div className="app-module-view app-chat-shell">
                  <div className="app-toolbar">
                    <div>
                      <p className="text-xs tracking-[0.12px] text-muted-foreground">
                        Conversation
                      </p>
                      <h2 className="font-heading text-[1.45rem] leading-[1.2]">
                        Chat Test
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Single conversation
                      </p>
                    </div>
                    <div className="app-toolbar-actions">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={<Button variant="outline" />}
                        >
                          More
                          <ChevronDownIcon data-icon="inline-end" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => setChatMessages([])}>
                            Clear Conversation
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => navigate("/settings")}
                          >
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

                  <Separator />

                  <div className="app-chat-stage">
                    <ScrollArea className="app-chat-log">
                      <div className="app-chat-log-inner">
                        {chatMessages.length === 0 && (
                          <p className="app-chat-empty-state">
                            Start a conversation to test the model.
                          </p>
                        )}
                        {chatMessages.map((message) => (
                          <div
                            key={message.id}
                            className={cn(
                              "app-chat-bubble",
                              message.role === "user"
                                ? "app-chat-bubble--user"
                                : "app-chat-bubble--assistant"
                            )}
                          >
                            {message.content || (chatRunning ? "..." : "")}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>

                    <div className="app-chat-composer-wrap">
                      <div className="app-chat-composer">
                        <Textarea
                          value={chatInput}
                          onChange={(event) => setChatInput(event.target.value)}
                          placeholder="Send message for single chat test"
                          className="min-h-24 resize-none rounded-none border-0 bg-transparent p-0 text-[0.98rem] leading-[1.6] text-[#141413] shadow-none outline-none placeholder:text-[#87867f] focus-visible:border-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
                        />
                        <div className="app-chat-composer-actions">
                          <Button
                            onClick={() =>
                              runChat().catch((cause) =>
                                setError(String(cause))
                              )
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
                </div>
              ) : (
                <ProjectFileExplorer
                  tree={tree}
                  activeFile={activeFile}
                  projectName={activeProject?.name || "Project"}
                  projectPath={activeProject?.localPath || ""}
                  onError={setError}
                  onOpenFile={openFile}
                  onRefresh={refreshTree}
                  onRenamePath={renameWorkspacePath}
                  onDeletePath={deleteWorkspacePath}
                />
              )}
            </div>

            <TooltipProvider delay={120}>
              <div className="app-module-dock">
                <div className="app-module-dock-meta">
                  <span className="app-module-dock-label">
                    {rightPanelView === "chat" ? "Chat" : "Files"}
                  </span>
                </div>
                <div className="app-module-dock-actions">
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Chat"
                          className={cn(
                            "app-module-dock-button",
                            rightPanelView === "chat" &&
                              "app-module-dock-button--active"
                          )}
                          onClick={() => setRightPanelView("chat")}
                        />
                      }
                    >
                      <MessageSquareIcon />
                    </TooltipTrigger>
                    <TooltipContent>Chat</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Files"
                          className={cn(
                            "app-module-dock-button",
                            rightPanelView === "files" &&
                              "app-module-dock-button--active"
                          )}
                          onClick={() => setRightPanelView("files")}
                        />
                      }
                    >
                      <FolderOpenIcon />
                    </TooltipTrigger>
                    <TooltipContent>Files</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </TooltipProvider>
          </section>
        </ResizablePanel>
      </ResizablePanelGroup>

      <Dialog open={clusterOpen} onOpenChange={setClusterOpen}>
        <DialogContent className="max-w-[95vw] overflow-hidden border-[#30302e] bg-[#141413] p-0 text-[#faf9f5]">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Cluster Test</DialogTitle>
          </DialogHeader>
          <div className="h-[80svh] border-t border-[#30302e] px-6 py-5">
            <ClusterChat
              systemPrompt={systemPrompt}
              apiKey={effectiveProvider.apiKey}
              defaultProvider={effectiveProvider.providerId}
              defaultModel={effectiveProvider.defaultModel}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
