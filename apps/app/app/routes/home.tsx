import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from "react"
import { useNavigate, useOutletContext } from "react-router"
import {
  ChevronDownIcon,
  CopyIcon,
  EllipsisIcon,
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
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
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
  const [isEditingFileName, setIsEditingFileName] = useState(false)
  const [renameRunning, setRenameRunning] = useState(false)
  const fileNameEditorRef = useRef<HTMLDivElement | null>(null)
  const fileBaseNameInputRef = useRef<HTMLInputElement | null>(null)
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
    setIsEditingFileName(false)
  }, [activeFile])

  useEffect(() => {
    if (!isEditingFileName) {
      return
    }

    fileBaseNameInputRef.current?.focus()
    fileBaseNameInputRef.current?.select()
  }, [isEditingFileName])

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
  const fileExtensionText = fileExtension.startsWith(".")
    ? fileExtension.slice(1)
    : fileExtension

  async function saveWorkspace() {
    await saveActiveFile()
  }

  async function copyActiveFilePath() {
    if (!activeFile) {
      return
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(activeFile)
        return
      }

      const input = document.createElement("input")
      input.value = activeFile
      input.setAttribute("readonly", "")
      input.style.position = "absolute"
      input.style.left = "-9999px"
      document.body.appendChild(input)
      input.select()
      document.execCommand("copy")
      document.body.removeChild(input)
    } catch (cause) {
      setError(String(cause))
    }
  }

  async function commitFileRename() {
    if (!hasActiveFile || renameRunning) {
      return false
    }

    const nextBaseName = fileBaseName.trim()
    if (!nextBaseName) {
      setError("file name is required")
      return false
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
      return true
    }

    setRenameRunning(true)

    try {
      const renamedPath = await renameActiveFile(nextPath)
      const nextParts = splitFileName(renamedPath)
      setFileBaseName(nextParts.baseName)
      setFileExtension(nextParts.extension)
      return true
    } catch (cause) {
      setError(String(cause))
      return false
    } finally {
      setRenameRunning(false)
    }
  }

  async function finishFileRename() {
    const didCommit = await commitFileRename()
    if (didCommit) {
      setIsEditingFileName(false)
    }
  }

  function handleFileNameBlur(event: FocusEvent<HTMLInputElement>) {
    const nextFocused = event.relatedTarget
    if (
      nextFocused instanceof Node &&
      fileNameEditorRef.current?.contains(nextFocused)
    ) {
      return
    }

    void finishFileRename()
  }

  function handleRenameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault()
      void finishFileRename()
      return
    }

    if (event.key === "Escape") {
      const nextParts = splitFileName(activeFile)
      setFileBaseName(nextParts.baseName)
      setFileExtension(nextParts.extension)
      setIsEditingFileName(false)
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
        className="min-h-dvh"
      >
        <ResizablePanel defaultSize={isDesktopLayout ? 58 : 60} minSize={35}>
          <main className="flex min-h-dvh flex-col bg-[radial-gradient(circle_at_top_left,rgb(201_100_66_/_8%),transparent_30%),linear-gradient(180deg,rgb(250_249_245_/_96%)_0%,rgb(245_244_237_/_82%)_100%)] dark:bg-none dark:bg-background">
            <div className="flex flex-none items-start justify-between gap-3 overflow-hidden px-4 pt-4 pb-5 lg:px-6 lg:pt-6 lg:pb-6">
              <div className="min-w-0 flex-1 overflow-hidden">
                {isEditingFileName ? (
                  <div
                    ref={fileNameEditorRef}
                    className="flex min-w-max items-baseline gap-x-0.5 overflow-hidden whitespace-nowrap"
                  >
                    <input
                      ref={fileBaseNameInputRef}
                      value={fileBaseName}
                      onChange={(event) => setFileBaseName(event.target.value)}
                      onBlur={handleFileNameBlur}
                      onKeyDown={handleRenameKeyDown}
                      placeholder=""
                      disabled={!hasActiveFile || renameRunning}
                      className="field-sizing-content h-auto min-w-0 flex-none border-0 bg-transparent p-0 font-heading !text-2xl leading-none text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <div className="flex w-max min-w-0 shrink-0 flex-none items-baseline whitespace-nowrap">
                      <span className="shrink-0 flex-none font-heading text-2xl leading-none text-muted-foreground">
                        .
                      </span>
                      <input
                        value={fileExtensionText}
                        onChange={(event) =>
                          setFileExtension(
                            event.target.value
                              ? `.${event.target.value.replace(/^\.+/, "")}`
                              : ""
                          )
                        }
                        onBlur={handleFileNameBlur}
                        onKeyDown={handleRenameKeyDown}
                        placeholder="md"
                        disabled={!hasActiveFile || renameRunning}
                        className="field-sizing-content h-auto min-w-[2ch] w-max flex-none border-0 bg-transparent p-0 font-heading !text-2xl leading-none text-muted-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="inline-flex w-fit max-w-full min-w-0 items-baseline gap-x-0.5 overflow-hidden text-left"
                    onClick={() => setIsEditingFileName(true)}
                    disabled={!hasActiveFile || renameRunning}
                    title={
                      fileExtensionText
                        ? `${fileBaseName || "untitled"}.${fileExtensionText}`
                        : fileBaseName || "untitled"
                    }
                  >
                    <span className="truncate font-heading text-2xl leading-none text-foreground">
                      {fileBaseName || "untitled"}
                    </span>
                    {fileExtensionText ? (
                      <span className="shrink-0 flex-none whitespace-nowrap font-heading text-2xl leading-none text-muted-foreground">
                        .{fileExtensionText}
                      </span>
                    ) : null}
                  </button>
                )}
              </div>
              <div className="shrink-0 flex flex-wrap gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="More actions"
                        title="More actions"
                      />
                    }
                  >
                    <EllipsisIcon />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem
                      onClick={() => void copyActiveFilePath()}
                      disabled={!hasActiveFile}
                    >
                      <CopyIcon />
                      Copy File Path
                    </DropdownMenuItem>
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

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-border/90 bg-transparent">
              <div className="min-h-0 flex-1 px-4 pt-[18px] pb-5 lg:px-6">
                <Textarea
                  value={fileContent}
                  onChange={(event) => setFileContent(event.target.value)}
                  placeholder="No file available in this project."
                  disabled={!hasActiveFile}
                  className="h-full min-h-full resize-none border-0 bg-transparent px-0 py-0 font-mono text-[0.95rem] leading-[1.75] shadow-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>

              <div className="sticky bottom-0 z-[1] flex-none border-t border-border/90 bg-background/85 px-4 pt-3 pb-[14px] backdrop-blur-sm lg:px-6">
                <div className="scrollbar-thin mt-0 flex flex-nowrap gap-2 overflow-x-auto overflow-y-hidden whitespace-nowrap">
                  <span className="inline-flex flex-none items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-muted-foreground">
                    {hasActiveFile
                      ? isFileDirty
                        ? "Status: Unsaved"
                        : "Status: Saved"
                      : "Status: No file"}
                  </span>
                  <span className="inline-flex flex-none items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-muted-foreground">
                    Chars: {formatCount(contentStats.characters)}
                  </span>
                  <span className="inline-flex flex-none items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-muted-foreground">
                    Words: {formatCount(contentStats.words)}
                  </span>
                  <span className="inline-flex flex-none items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-muted-foreground">
                    Tokens: {formatCount(contentStats.tokens)}
                  </span>
                  <span className="inline-flex flex-none items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-muted-foreground">
                    Lines: {formatCount(contentStats.lines)}
                  </span>
                  <span className="inline-flex flex-none items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-muted-foreground">
                    Last sync: {syncStatus?.local?.lastSyncedAt || "never"}
                  </span>
                  <span className="inline-flex flex-none items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-muted-foreground">
                    Cloud rev: {syncStatus?.cloud?.revision ?? 0}
                  </span>
                  <span className="inline-flex flex-none items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-muted-foreground">
                    Conflicts: {syncStatus?.local?.conflicts?.length || 0}
                  </span>
                </div>
              </div>
            </div>
          </main>
        </ResizablePanel>

        <ResizableHandle className="bg-transparent" />

        <ResizablePanel defaultSize={isDesktopLayout ? 42 : 40} minSize={25}>
          <section className="flex min-h-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top_right,rgb(201_100_66_/_5%),transparent_30%),linear-gradient(180deg,rgb(250_249_245_/_94%)_0%,rgb(245_244_237_/_86%)_100%)] p-0 dark:bg-none dark:bg-background lg:border-l lg:border-border">
            <div
              className={cn(
                "min-h-0 flex-1 overflow-y-auto overscroll-contain",
                rightPanelView === "chat" && "flex flex-col overflow-hidden"
              )}
            >
              {rightPanelView === "chat" ? (
                <div className="flex min-h-full flex-1 flex-col p-4 lg:p-6">
                  <div className="flex items-center justify-between gap-3">
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
                    <div className="flex flex-wrap gap-2">
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

                  <div className="relative flex min-h-0 flex-1 flex-col pt-[18px]">
                    <ScrollArea className="min-h-0 flex-1 p-0">
                      <div className="flex flex-col gap-3 pr-1 pb-[228px]">
                        {chatMessages.length === 0 && (
                          <p className="max-w-[28rem] pt-[14px] text-[0.96rem] leading-[1.6] text-muted-foreground">
                            Start a conversation to test the model.
                          </p>
                        )}
                        {chatMessages.map((message) => (
                          <div
                            key={message.id}
                            className={cn(
                              "max-w-[min(86%,42rem)] rounded-[24px] px-4 py-[14px] text-[0.96rem] leading-[1.6] shadow-[0_0_0_1px_rgb(240_238_230_/_88%)] dark:shadow-[0_0_0_1px_rgb(48_48_46_/_96%)]",
                              message.role === "user"
                                ? "ml-auto bg-[#c96442] text-[#faf9f5] shadow-[0_18px_38px_rgb(201_100_66_/_18%),0_0_0_1px_rgb(201_100_66_/_92%)]"
                                : "border border-border/90 bg-card/95 text-foreground"
                            )}
                          >
                            {message.content || (chatRunning ? "..." : "")}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>

                    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] bg-[linear-gradient(180deg,rgb(245_244_237_/_0%)_0%,rgb(245_244_237_/_78%)_34%,rgb(245_244_237_/_96%)_62%,rgb(245_244_237_/_100%)_100%)] pt-7 dark:bg-[linear-gradient(180deg,rgb(20_20_19_/_0%)_0%,rgb(20_20_19_/_78%)_34%,rgb(20_20_19_/_96%)_62%,rgb(20_20_19_/_100%)_100%)]">
                      <div className="pointer-events-auto flex flex-col gap-3 rounded-[28px] border border-border/90 bg-card/95 p-[18px] shadow-[0_0_0_1px_rgb(240_238_230_/_96%)] backdrop-blur-[16px] dark:shadow-[0_0_0_1px_rgb(48_48_46_/_96%)]">
                        <Textarea
                          value={chatInput}
                          onChange={(event) => setChatInput(event.target.value)}
                          placeholder="Send message for single chat test"
                          className="min-h-24 resize-none rounded-none border-0 bg-transparent p-0 text-[0.98rem] leading-[1.6] text-foreground shadow-none outline-none placeholder:text-muted-foreground focus-visible:border-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
                        />
                        <div className="flex justify-end">
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
              <div className="flex min-h-[52px] flex-none items-center gap-3 border-t border-border/90 bg-transparent px-[18px] py-2.5">
                <div className="min-w-0 flex-1">
                  <span className="text-[0.72rem] tracking-[0.12px] text-muted-foreground uppercase">
                    {rightPanelView === "chat" ? "Chat" : "Files"}
                  </span>
                </div>
                <div className="ml-auto flex flex-none items-center justify-end gap-1.5">
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Chat"
                          className={cn(
                            "text-muted-foreground",
                            rightPanelView === "chat" &&
                              "bg-background/80 text-foreground shadow-[0_0_0_1px_rgb(209_207_197_/_88%)] dark:shadow-[0_0_0_1px_rgb(48_48_46_/_96%)]"
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
                            "text-muted-foreground",
                            rightPanelView === "files" &&
                              "bg-background/80 text-foreground shadow-[0_0_0_1px_rgb(209_207_197_/_88%)] dark:shadow-[0_0_0_1px_rgb(48_48_46_/_96%)]"
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
        <DialogContent className="max-w-[95vw] overflow-hidden border-border bg-background p-0 text-foreground">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Cluster Test</DialogTitle>
          </DialogHeader>
          <div className="h-[80svh] border-t border-border px-6 py-5">
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
