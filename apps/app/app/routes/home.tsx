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
  CopyIcon,
  EllipsisIcon,
  FolderOpenIcon,
  MessageSquareIcon,
  SaveIcon,
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
import { PlaygroundPanel } from "../components/playground-panel"
import { ProjectFileExplorer } from "../components/project-file-explorer"
import {
  APP_SETTINGS_UPDATED_EVENT,
  getAppSettings,
  getEffectiveProviderConfig,
  getPlaygroundModelOptions,
  type AppSettings,
} from "../lib/app-settings"
import { getRootFileByName } from "../lib/project-playground"
import { estimateTokensForPreset } from "../lib/token-estimation"
import type { WorkspaceShellContext } from "./workspace"

type RightPanelView = "chat" | "files"

type FileNameParts = {
  baseName: string
  extension: string
}

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

const DESKTOP_RIGHT_PANEL_MIN_SIZE = 32
const PLAYGROUND_MODEL_BY_PROJECT_STORAGE_KEY =
  "otter.playground.modelByProject"

function getStoredPlaygroundModelByProject() {
  if (typeof window === "undefined") {
    return {}
  }

  const raw = window.localStorage.getItem(PLAYGROUND_MODEL_BY_PROJECT_STORAGE_KEY)
  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") {
      return {}
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([projectId, modelKey]) =>
          typeof projectId === "string" && typeof modelKey === "string"
      )
    ) as Record<string, string>
  } catch {
    return {}
  }
}

function getStoredPlaygroundModelKey(projectId: string) {
  return getStoredPlaygroundModelByProject()[projectId] || ""
}

function setStoredPlaygroundModelKey(projectId: string, modelKey: string) {
  if (typeof window === "undefined") {
    return
  }

  const current = getStoredPlaygroundModelByProject()
  current[projectId] = modelKey
  window.localStorage.setItem(
    PLAYGROUND_MODEL_BY_PROJECT_STORAGE_KEY,
    JSON.stringify(current)
  )
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

  const [settings, setSettings] = useState<AppSettings>(getAppSettings())
  const [selectedModelKey, setSelectedModelKey] = useState("")
  const [clusterOpen, setClusterOpen] = useState(false)
  const [rightPanelView, setRightPanelView] = useState<RightPanelView>("chat")
  const [fileBaseName, setFileBaseName] = useState("")
  const [fileExtension, setFileExtension] = useState("")
  const [isDesktopLayout, setIsDesktopLayout] = useState(false)
  const [isEditingFileName, setIsEditingFileName] = useState(false)
  const [renameRunning, setRenameRunning] = useState(false)
  const fileNameEditorRef = useRef<HTMLDivElement | null>(null)
  const fileBaseNameInputRef = useRef<HTMLInputElement | null>(null)
  const previousProjectIdRef = useRef<string | null>(null)

  useEffect(() => {
    const syncSettings = () => setSettings(getAppSettings())

    syncSettings()
    window.addEventListener(APP_SETTINGS_UPDATED_EVENT, syncSettings)

    return () =>
      window.removeEventListener(APP_SETTINGS_UPDATED_EVENT, syncSettings)
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
  const modelOptions = useMemo(
    () => getPlaygroundModelOptions(settings),
    [settings]
  )
  const mainPromptFile = useMemo(
    () => getRootFileByName(tree, "main.md"),
    [tree]
  )
  const selectedModel = useMemo(
    () =>
      modelOptions.find((option) => option.key === selectedModelKey) ||
      modelOptions[0] ||
      null,
    [modelOptions, selectedModelKey]
  )
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

  useEffect(() => {
    const projectId = activeProject?.id || null
    const modelKeySet = new Set(modelOptions.map((option) => option.key))
    const projectChanged = previousProjectIdRef.current !== projectId
    previousProjectIdRef.current = projectId

    if (!projectId) {
      if (selectedModelKey) {
        setSelectedModelKey("")
      }
      return
    }

    if (!projectChanged && selectedModelKey && modelKeySet.has(selectedModelKey)) {
      return
    }

    const storedModelKey = getStoredPlaygroundModelKey(projectId)
    if (storedModelKey && modelKeySet.has(storedModelKey)) {
      if (selectedModelKey !== storedModelKey) {
        setSelectedModelKey(storedModelKey)
      }
      return
    }

    const fallbackModelKey = modelOptions[0]?.key || ""
    if (selectedModelKey !== fallbackModelKey) {
      setSelectedModelKey(fallbackModelKey)
    }
  }, [activeProject?.id, modelOptions, selectedModelKey])

  useEffect(() => {
    if (!activeProject?.id || !selectedModelKey) {
      return
    }

    setStoredPlaygroundModelKey(activeProject.id, selectedModelKey)
  }, [activeProject?.id, selectedModelKey])

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

  function openClusterTest() {
    if (settings.general.clusterOpenMode === "page") {
      const query = activeProject?.id
        ? `?projectId=${encodeURIComponent(activeProject.id)}`
        : ""
      navigate(`/cluster${query}`)
      return
    }

    setClusterOpen(true)
  }

  return (
    <>
      <ResizablePanelGroup
        direction={isDesktopLayout ? "horizontal" : "vertical"}
        className="h-full min-h-0"
      >
        <ResizablePanel
          defaultSize={isDesktopLayout ? 58 : 60}
          minSize={isDesktopLayout ? 100 - DESKTOP_RIGHT_PANEL_MIN_SIZE : 35}
          className="min-h-0 min-w-0"
        >
          <main className="flex h-full min-h-0 min-w-0 flex-col bg-[radial-gradient(circle_at_top_left,rgb(201_100_66_/_8%),transparent_30%),linear-gradient(180deg,rgb(250_249_245_/_96%)_0%,rgb(245_244_237_/_82%)_100%)] dark:bg-background dark:bg-none">
            <div className="flex flex-none items-start justify-between gap-3 overflow-hidden px-4 pt-4 pb-5 lg:px-6 lg:pt-6 lg:pb-6">
              <div className="min-w-0 flex-1 overflow-hidden">
                {isEditingFileName ? (
                  <div
                    ref={fileNameEditorRef}
                    className="flex min-w-0 flex-1 items-baseline gap-x-0.5 overflow-hidden whitespace-nowrap"
                  >
                    <input
                      ref={fileBaseNameInputRef}
                      value={fileBaseName}
                      onChange={(event) => setFileBaseName(event.target.value)}
                      onBlur={handleFileNameBlur}
                      onKeyDown={handleRenameKeyDown}
                      placeholder=""
                      disabled={!hasActiveFile || renameRunning}
                      className="h-auto min-w-0 flex-1 border-0 bg-transparent p-0 font-heading !text-2xl leading-none text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <div className="flex w-max min-w-0 flex-none shrink-0 items-baseline whitespace-nowrap">
                      <span className="flex-none shrink-0 font-heading text-2xl leading-none text-muted-foreground">
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
                        className="field-sizing-content h-auto w-max min-w-[2ch] flex-none border-0 bg-transparent p-0 font-heading !text-2xl leading-none text-muted-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-baseline gap-x-0.5 overflow-hidden text-left"
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
                      <span className="flex-none shrink-0 font-heading text-2xl leading-none whitespace-nowrap text-muted-foreground">
                        .{fileExtensionText}
                      </span>
                    ) : null}
                  </button>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
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

              <div className="sticky bottom-0 z-[1] flex min-h-[72px] flex-none items-center border-t border-border/90 bg-background/85 px-4 py-3 backdrop-blur-sm lg:px-6">
                <div className="scrollbar-thin flex w-full flex-nowrap gap-2 overflow-x-auto overflow-y-hidden whitespace-nowrap">
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

        <ResizablePanel
          defaultSize={isDesktopLayout ? 42 : 40}
          minSize={isDesktopLayout ? DESKTOP_RIGHT_PANEL_MIN_SIZE : 25}
          className="min-h-0 min-w-0"
        >
          <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_top_right,rgb(201_100_66_/_5%),transparent_30%),linear-gradient(180deg,rgb(250_249_245_/_94%)_0%,rgb(245_244_237_/_86%)_100%)] p-0 lg:border-l lg:border-border dark:bg-background dark:bg-none">
            <div
              className={cn(
                "min-h-0 min-w-0 flex-1 overflow-hidden",
                rightPanelView === "chat" && "flex flex-col"
              )}
            >
              {rightPanelView === "chat" ? (
                <PlaygroundPanel
                  projectId={activeProject?.id || ""}
                  modelOptions={modelOptions}
                  selectedModelKey={selectedModelKey}
                  selectedModel={selectedModel}
                  mainPromptPath={mainPromptFile?.path || null}
                  onSelectModelKey={setSelectedModelKey}
                  onOpenClusterTest={openClusterTest}
                  onOpenSettings={() => navigate("/settings")}
                  onError={setError}
                />
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
              <div className="flex min-h-[72px] shrink-0 items-center gap-3 border-t border-border/90 bg-transparent px-4 py-3 lg:px-6">
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
        <DialogContent className="flex h-[95vh] w-[95vw] min-h-[95vh] min-w-[95vw] max-h-[95vh] max-w-[95vw] flex-col gap-0 overflow-hidden border-border bg-background p-0 text-foreground sm:max-w-[95vw]">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Cluster Test</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 border-t border-border px-6 py-5">
            <ClusterChat
              projectId={activeProject?.id || ""}
              modelOptions={modelOptions}
              defaultModelKey={
                selectedModel?.key ||
                effectiveProvider.defaultModelOption?.key ||
                modelOptions[0]?.key ||
                ""
              }
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
