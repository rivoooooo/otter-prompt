import { Link, useNavigate } from "react-router"
import { useEffect, useMemo, useState } from "react"
import {
  ChevronDownIcon,
  FolderIcon,
  FolderOpenIcon,
  PlusIcon,
  SaveIcon,
  SendIcon,
  SparklesIcon,
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@workspace/ui/components/collapsible"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"
import { Textarea } from "@workspace/ui/components/textarea"
import { apiRequest, apiStream } from "../lib/api-client"
import { getAppSettings, saveAppSettings, type AppSettings } from "../lib/app-settings"
import { ClusterChat } from "../components/cluster-chat"
import { DirectoryBrowser } from "../components/directory-browser"
import {
  fetchFile,
  fetchTree,
  removePath,
  saveFile,
  type TreeNode,
} from "../lib/fs-api"
import { SettingsForm } from "../components/settings-form"

type Project = {
  id: string
  name: string
  localPath: string
  lastSyncedAt?: string | null
}

type SyncStatus = {
  local?: {
    lastSyncedAt?: string | null
    conflicts?: Array<{ path: string; conflictFile: string }>
  }
  cloud?: {
    revision?: number
  }
}

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
}

const SYSTEM_PROMPT_KEY = "otter.systemPrompt"
const nextId = () => Math.random().toString(36).slice(2)

function FileTree({
  node,
  activeFile,
  onSelect,
}: {
  node: TreeNode
  activeFile: string
  onSelect: (node: TreeNode) => void
}) {
  if (node.type === "file") {
    const isActive = node.path === activeFile

    return (
      <button
        className={`w-full truncate rounded-md px-2 py-1 text-left text-sm ${
          isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent"
        }`}
        onClick={() => onSelect(node)}
      >
        {node.name}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <p className="truncate px-2 text-xs text-sidebar-foreground/70">{node.name}</p>
      <div className="flex flex-col gap-1 border-l border-sidebar-border pl-3">
        {(node.children || []).map((child) => (
          <FileTree
            key={child.path}
            node={child}
            activeFile={activeFile}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [activeProject, setActiveProject] = useState<Project | null>(null)
  const [tree, setTree] = useState<TreeNode | null>(null)
  const [newProjectPath, setNewProjectPath] = useState("")
  const [addProjectDialogOpen, setAddProjectDialogOpen] = useState(false)
  const [activeFile, setActiveFile] = useState("")
  const [fileContent, setFileContent] = useState("")
  const [systemPrompt, setSystemPrompt] = useState("")
  const [chatInput, setChatInput] = useState("")
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [settings, setSettings] = useState<AppSettings>(getAppSettings())
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [promptOpen, setPromptOpen] = useState(true)
  const [fileOpen, setFileOpen] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [clusterOpen, setClusterOpen] = useState(false)
  const [chatRunning, setChatRunning] = useState(false)
  const [error, setError] = useState("")

  const hasActiveFile = useMemo(() => Boolean(activeFile), [activeFile])

  useEffect(() => {
    setSettings(getAppSettings())
    setSystemPrompt(window.localStorage.getItem(SYSTEM_PROMPT_KEY) || "")
  }, [])

  useEffect(() => {
    apiRequest<{ projects: Project[] }>("/projects")
      .then((body) => {
        setProjects(body.projects)
        if (body.projects.length > 0) {
          setActiveProject(body.projects[0])
        }
      })
      .catch((cause) => setError(String(cause)))
  }, [])

  useEffect(() => {
    if (!activeProject?.localPath) {
      setTree(null)
      return
    }

    fetchTree(activeProject.localPath)
      .then((nextTree) => setTree(nextTree))
      .catch((cause) => setError(String(cause)))
  }, [activeProject])

  useEffect(() => {
    if (!activeProject?.id) {
      setSyncStatus(null)
      return
    }

    apiRequest<SyncStatus>(`/sync/status?projectId=${encodeURIComponent(activeProject.id)}`)
      .then((body) => setSyncStatus(body))
      .catch(() => setSyncStatus(null))
  }, [activeProject?.id])

  async function loadFile(node: TreeNode) {
    if (node.type !== "file") {
      return
    }

    setActiveFile(node.path)
    const content = await fetchFile(node.path)
    setFileContent(content)
  }

  async function saveWorkspace() {
    window.localStorage.setItem(SYSTEM_PROMPT_KEY, systemPrompt)

    if (activeFile) {
      await saveFile(activeFile, fileContent)
    }
  }

  async function deleteActiveFile() {
    if (!activeFile) {
      return
    }

    await removePath(activeFile)

    setActiveFile("")
    setFileContent("")

    if (activeProject?.localPath) {
      const nextTree = await fetchTree(activeProject.localPath)
      setTree(nextTree)
    }
  }

  async function addProject() {
    if (!newProjectPath.trim()) {
      return
    }

    const body = await apiRequest<{ project: Project }>(`/projects`, {
      method: "POST",
      body: JSON.stringify({
        localPath: newProjectPath,
        name: newProjectPath.split("/").filter(Boolean).pop() || "Project",
      }),
    })

    setProjects((current) => [body.project, ...current])
    setActiveProject(body.project)
    setNewProjectPath("")
  }

  async function syncPush() {
    if (!activeProject?.id) {
      return
    }

    const body = await apiRequest<{ project: Project; sync: SyncStatus["local"] }>(`/sync/push`, {
      method: "POST",
      body: JSON.stringify({ projectId: activeProject.id }),
    })

    setProjects((current) =>
      current.map((project) => (project.id === body.project.id ? body.project : project)),
    )
    setSyncStatus((current) => ({ ...current, local: body.sync }))
  }

  async function syncPull() {
    if (!activeProject?.id) {
      return
    }

    const body = await apiRequest<{ project: Project; sync: SyncStatus["local"] }>(`/sync/pull`, {
      method: "POST",
      body: JSON.stringify({ projectId: activeProject.id }),
    })

    setProjects((current) =>
      current.map((project) => (project.id === body.project.id ? body.project : project)),
    )
    setSyncStatus((current) => ({ ...current, local: body.sync }))
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
        { apiKey: settings.apiKey },
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
                : message,
            ),
          )
        }
      }
    } catch (cause) {
      setChatMessages((current) =>
        current.map((message) =>
          message.id === assistantId
            ? { ...message, content: `Error: ${String(cause)}` }
            : message,
        ),
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

  function updateSettings(next: AppSettings) {
    setSettings(next)
    saveAppSettings(next)
  }

  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <FolderIcon />
            <span className="truncate font-medium group-data-[collapsible=icon]:hidden">
              Projects
            </span>
          </div>
        </SidebarHeader>

        <SidebarSeparator />

        <SidebarContent>
          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <div className="flex items-center justify-between px-2">
              <SidebarGroupLabel className="h-auto px-0 py-0">Project List</SidebarGroupLabel>
              <Dialog open={addProjectDialogOpen} onOpenChange={setAddProjectDialogOpen}>
                <DialogTrigger render={<Button variant="ghost" />}>
                  <PlusIcon data-icon="inline-start" />
                  Add
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Project</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col gap-3">
                    <p className="text-sm text-muted-foreground">
                      Default roots include <code>~</code> and your used project directories.
                    </p>
                    <DirectoryBrowser
                      selectedPath={newProjectPath}
                      onSelect={setNewProjectPath}
                      onError={setError}
                    />
                    <Input
                      placeholder="/absolute/path/to/project"
                      value={newProjectPath}
                      onChange={(event) => setNewProjectPath(event.target.value)}
                    />
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        onClick={() =>
                          apiRequest<{ path: string }>("/dialog/directory", {
                            method: "POST",
                          })
                            .then((body) => setNewProjectPath(body.path))
                            .catch((cause) => setError(String(cause)))
                        }
                      >
                        <FolderOpenIcon data-icon="inline-start" />
                        Use System Picker
                      </Button>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        onClick={() =>
                          addProject()
                            .then(() => setAddProjectDialogOpen(false))
                            .catch((cause) => setError(String(cause)))
                        }
                        disabled={!newProjectPath.trim()}
                      >
                        Save Project
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <SidebarGroupContent className="flex flex-col gap-1">
              {projects.map((project) => (
                <button
                  key={project.id}
                  className={`truncate rounded-md px-2 py-1.5 text-left text-sm group-data-[collapsible=icon]:text-center ${
                    activeProject?.id === project.id
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "hover:bg-sidebar-accent"
                  }`}
                  onClick={() => setActiveProject(project)}
                  title={project.name}
                >
                  {project.name}
                </button>
              ))}
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <SidebarGroupLabel>Files</SidebarGroupLabel>
            <SidebarGroupContent>
              <ScrollArea className="h-[45svh] pr-2">
                {tree ? (
                  <FileTree node={tree} activeFile={activeFile} onSelect={loadFile} />
                ) : (
                  <p className="text-sm text-muted-foreground">No project tree.</p>
                )}
              </ScrollArea>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="group-data-[collapsible=icon]:hidden">
          <div className="flex flex-col gap-2">
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DialogTrigger render={<Button variant="outline" />}>Settings Dialog</DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Settings</DialogTitle>
                </DialogHeader>
                <SettingsForm
                  initialSettings={settings}
                  onSave={(next) => {
                    updateSettings(next)
                    setSettingsOpen(false)
                  }}
                />
              </DialogContent>
            </Dialog>
            <Button variant="outline" render={<Link to="/settings" />}>
              Settings Page
            </Button>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <div className="grid h-svh grid-cols-1 lg:grid-cols-[minmax(0,1fr)_28rem]">
          <main className="flex min-h-0 flex-col border-r border-border bg-background p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h1 className="font-heading text-xl">Prompt Editor</h1>
                <p className="text-sm text-muted-foreground">
                  {activeFile || "No file selected"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="outline" />}>
                    Actions
                    <ChevronDownIcon data-icon="inline-end" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuGroup>
                      <DropdownMenuItem onClick={() => setSystemPrompt("")}>Clear Prompt</DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => deleteActiveFile().catch((cause) => setError(String(cause)))}
                        disabled={!hasActiveFile}
                      >
                        Delete Active File
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button onClick={() => saveWorkspace().catch((cause) => setError(String(cause)))}>
                  <SaveIcon data-icon="inline-start" />
                  Save
                </Button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <Collapsible open={promptOpen} onOpenChange={setPromptOpen}>
                <div className="rounded-xl border border-border">
                  <CollapsibleTrigger
                    render={<button className="flex w-full items-center justify-between px-3 py-2 text-left" />}
                  >
                    <span className="font-medium">System Prompt</span>
                    <ChevronDownIcon className={`transition ${promptOpen ? "rotate-180" : ""}`} />
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
                <div className="rounded-xl border border-border">
                  <CollapsibleTrigger
                    render={<button className="flex w-full items-center justify-between px-3 py-2 text-left" />}
                  >
                    <span className="font-medium">Active File Content</span>
                    <ChevronDownIcon className={`transition ${fileOpen ? "rotate-180" : ""}`} />
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

            <p className="mt-3 text-xs text-muted-foreground">
              Last sync: {syncStatus?.local?.lastSyncedAt || "never"} | Cloud rev: {syncStatus?.cloud?.revision ?? 0} |
              Conflicts: {syncStatus?.local?.conflicts?.length || 0}
            </p>
          </main>

          <section className="flex min-h-0 flex-col bg-background p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h2 className="font-heading text-lg">Chat Test</h2>
                <p className="text-sm text-muted-foreground">Single conversation</p>
              </div>
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="outline" />}>
                    More
                    <ChevronDownIcon data-icon="inline-end" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setChatMessages([])}>Clear Conversation</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSettingsOpen(true)}>Open Settings</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="outline" onClick={openClusterTest}>
                  <SparklesIcon data-icon="inline-start" />
                  Cluster Test
                </Button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
              <ScrollArea className="min-h-0 flex-1 rounded-xl border border-border p-3">
                <div className="flex flex-col gap-2 pb-4">
                  {chatMessages.length === 0 && (
                    <p className="text-sm text-muted-foreground">Start a chat to test your prompt.</p>
                  )}
                  {chatMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`max-w-[90%] rounded-md px-3 py-2 text-sm ${
                        message.role === "user"
                          ? "ml-auto bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      {message.content || (chatRunning ? "..." : "")}
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="mt-3 rounded-xl border border-border bg-background p-3 shadow-sm">
                <div className="flex flex-col gap-2">
                  <Textarea
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    placeholder="Send message for single chat test"
                    className="min-h-24"
                  />
                  <div className="flex justify-end">
                    <Button
                      onClick={() => runChat().catch((cause) => setError(String(cause)))}
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
        </div>
      </SidebarInset>

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

      {error && (
        <div className="fixed right-4 bottom-4 rounded-md bg-destructive px-3 py-2 text-xs text-white">
          {error}
        </div>
      )}
    </SidebarProvider>
  )
}
