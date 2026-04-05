import { Link, Outlet, useLocation, useNavigate, useParams } from "react-router"
import { useEffect, useMemo, useState } from "react"
import { EllipsisIcon, FolderOpenIcon, PlusIcon } from "lucide-react"
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
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"
import { DirectoryBrowser } from "../components/directory-browser"
import { apiRequest } from "../lib/api-client"
import {
  fetchFile,
  fetchTree,
  removePath,
  renameFile,
  saveFile,
  type TreeNode,
} from "../lib/fs-api"
import { createProject, listProjects, type Project } from "../lib/projects"

type SyncStatus = {
  local?: {
    lastSyncedAt?: string | null
    conflicts?: Array<{ path: string; conflictFile: string }>
  }
  cloud?: {
    revision?: number
  }
}

const WORKSPACE_SIDEBAR_STORAGE_KEY = "otter.workspace.sidebar.open"

function getStoredWorkspaceSidebarOpen() {
  if (typeof window === "undefined") {
    return true
  }

  const raw = window.localStorage.getItem(WORKSPACE_SIDEBAR_STORAGE_KEY)
  if (raw === null) {
    return true
  }

  return raw === "true"
}

export type WorkspaceShellContext = {
  activeProject: Project | null
  tree: TreeNode | null
  activeFile: string
  fileContent: string
  hasActiveFile: boolean
  isFileDirty: boolean
  syncStatus: SyncStatus | null
  error: string
  setError: (message: string) => void
  setFileContent: (value: string) => void
  openFile: (path: string) => Promise<void>
  refreshTree: () => Promise<TreeNode | null>
  saveActiveFile: () => Promise<void>
  renameActiveFile: (nextPath: string) => Promise<string>
  deleteActiveFile: () => Promise<void>
  renameWorkspacePath: (
    currentPath: string,
    nextPath: string
  ) => Promise<string>
  deleteWorkspacePath: (path: string) => Promise<void>
}

function findFirstFile(node: TreeNode): TreeNode | null {
  if (node.type === "file") {
    return node
  }

  for (const child of node.children || []) {
    const nextFile = findFirstFile(child)
    if (nextFile) {
      return nextFile
    }
  }

  return null
}

function treeContainsPath(node: TreeNode, path: string) {
  if (node.path === path) {
    return true
  }

  for (const child of node.children || []) {
    if (treeContainsPath(child, path)) {
      return true
    }
  }

  return false
}

function isPathWithin(path: string, rootPath: string) {
  return (
    path === rootPath ||
    path.startsWith(`${rootPath}/`) ||
    path.startsWith(`${rootPath}\\`)
  )
}

function rewritePathPrefix(
  path: string,
  currentPrefix: string,
  nextPrefix: string
) {
  if (path === currentPrefix) {
    return nextPrefix
  }

  if (path.startsWith(`${currentPrefix}/`)) {
    return `${nextPrefix}${path.slice(currentPrefix.length)}`
  }

  if (path.startsWith(`${currentPrefix}\\`)) {
    return `${nextPrefix}${path.slice(currentPrefix.length)}`
  }

  return path
}

export default function WorkspaceRoute() {
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams()

  const [projects, setProjects] = useState<Project[]>([])
  const [newProjectPath, setNewProjectPath] = useState("")
  const [addProjectDialogOpen, setAddProjectDialogOpen] = useState(false)
  const [tree, setTree] = useState<TreeNode | null>(null)
  const [activeFile, setActiveFile] = useState("")
  const [fileContent, setFileContent] = useState("")
  const [savedFileContent, setSavedFileContent] = useState("")
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [error, setError] = useState("")
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    getStoredWorkspaceSidebarOpen()
  )

  const hasActiveFile = useMemo(() => Boolean(activeFile), [activeFile])
  const isFileDirty = useMemo(
    () => hasActiveFile && fileContent !== savedFileContent,
    [fileContent, hasActiveFile, savedFileContent]
  )
  const activeProject = useMemo(
    () => projects.find((project) => project.id === params.projectId) || null,
    [projects, params.projectId]
  )

  useEffect(() => {
    listProjects()
      .then((body) => {
        setProjects(body.projects)
      })
      .catch((cause) => setError(String(cause)))
  }, [])

  useEffect(() => {
    if (
      location.pathname.startsWith("/project/") &&
      params.projectId &&
      projects.length > 0 &&
      !activeProject
    ) {
      navigate(`/project/${projects[0].id}`, { replace: true })
    }
  }, [location.pathname, params.projectId, projects, activeProject, navigate])

  useEffect(() => {
    if (!activeProject?.localPath) {
      setTree(null)
      setActiveFile("")
      setFileContent("")
      setSavedFileContent("")
      return
    }

    const projectPath = activeProject.localPath
    let cancelled = false

    async function syncProjectFiles() {
      try {
        const nextTree = await fetchTree(projectPath)
        if (cancelled) {
          return
        }

        setTree(nextTree)

        const hasValidActiveFile =
          isPathWithin(activeFile, projectPath) &&
          treeContainsPath(nextTree, activeFile)

        if (hasValidActiveFile) {
          return
        }

        const nextFile = findFirstFile(nextTree)
        if (!nextFile) {
          setActiveFile("")
          setFileContent("")
          setSavedFileContent("")
          return
        }

        const content = await fetchFile(nextFile.path)
        if (cancelled) {
          return
        }

        setActiveFile(nextFile.path)
        setFileContent(content)
        setSavedFileContent(content)
      } catch (cause) {
        if (!cancelled) {
          setError(String(cause))
        }
      }
    }

    void syncProjectFiles()

    return () => {
      cancelled = true
    }
  }, [activeFile, activeProject?.localPath])

  useEffect(() => {
    if (!activeProject?.id) {
      setSyncStatus(null)
      return
    }

    apiRequest<SyncStatus>(
      `/sync/status?projectId=${encodeURIComponent(activeProject.id)}`
    )
      .then((body) => setSyncStatus(body))
      .catch(() => setSyncStatus(null))
  }, [activeProject?.id])

  useEffect(() => {
    window.localStorage.setItem(
      WORKSPACE_SIDEBAR_STORAGE_KEY,
      String(sidebarOpen)
    )
  }, [sidebarOpen])

  async function saveActiveFile() {
    if (!activeFile) {
      return
    }

    await saveFile(activeFile, fileContent)
    setSavedFileContent(fileContent)
  }

  async function openFile(path: string) {
    const content = await fetchFile(path)
    setActiveFile(path)
    setFileContent(content)
    setSavedFileContent(content)
  }

  async function refreshTree() {
    if (!activeProject?.localPath) {
      setTree(null)
      return null
    }

    const nextTree = await fetchTree(activeProject.localPath)
    setTree(nextTree)
    return nextTree
  }

  async function openFirstFileOrReset(nextTree: TreeNode | null) {
    const nextFile = nextTree ? findFirstFile(nextTree) : null
    if (!nextFile) {
      setActiveFile("")
      setFileContent("")
      setSavedFileContent("")
      return
    }

    await openFile(nextFile.path)
  }

  async function renameWorkspacePath(currentPath: string, nextPath: string) {
    const renamedPath = await renameFile(currentPath, nextPath)

    if (activeFile === currentPath || isPathWithin(activeFile, currentPath)) {
      setActiveFile((current) =>
        rewritePathPrefix(current, currentPath, renamedPath)
      )
    }

    await refreshTree()
    return renamedPath
  }

  async function renameActiveFile(nextPath: string) {
    if (!activeFile) {
      return activeFile
    }

    return renameWorkspacePath(activeFile, nextPath)
  }

  async function deleteWorkspacePath(path: string) {
    await removePath(path)

    const deletedActiveFile =
      activeFile === path || isPathWithin(activeFile, path)
    const nextTree = await refreshTree()

    if (deletedActiveFile) {
      await openFirstFileOrReset(nextTree)
    }
  }

  async function deleteActiveFile() {
    if (!activeFile) {
      return
    }

    await deleteWorkspacePath(activeFile)
  }

  async function addProject() {
    if (!newProjectPath.trim()) {
      return
    }

    const body = await createProject(newProjectPath)

    setProjects((current) => {
      if (current.some((project) => project.id === body.project.id)) {
        return current
      }

      return [body.project, ...current]
    })

    setNewProjectPath("")
    navigate(`/project/${body.project.id}`)
  }

  const context: WorkspaceShellContext = {
    activeProject,
    tree,
    activeFile,
    fileContent,
    hasActiveFile,
    isFileDirty,
    syncStatus,
    error,
    setError,
    setFileContent,
    openFile,
    refreshTree,
    saveActiveFile,
    renameActiveFile,
    deleteActiveFile,
    renameWorkspacePath,
    deleteWorkspacePath,
  }

  return (
    <SidebarProvider
      open={sidebarOpen}
      onOpenChange={setSidebarOpen}
      className="h-svh overflow-hidden"
      style={
        {
          "--sidebar": "var(--background)",
        } as React.CSSProperties
      }
    >
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:justify-center">
            <span className="truncate font-heading text-xl leading-none font-bold group-data-[collapsible=icon]:hidden">
              Otter
            </span>
            <SidebarTrigger />
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <div className="flex items-center justify-between px-2">
              <SidebarGroupLabel className="h-auto px-0 py-0">
                Project List
              </SidebarGroupLabel>
              <div className="flex items-center gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Project actions"
                        title="Project actions"
                      />
                    }
                  >
                    <EllipsisIcon />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuGroup>
                      <DropdownMenuItem
                        onClick={() => setAddProjectDialogOpen(true)}
                      >
                        <PlusIcon />
                        Add
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/projects")}>
                        <FolderOpenIcon />
                        Manager
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Dialog
                  open={addProjectDialogOpen}
                  onOpenChange={setAddProjectDialogOpen}
                >
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Project</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-3">
                      <p className="text-sm text-muted-foreground">
                        Default roots include <code>~</code> and your used
                        project directories.
                      </p>
                      <DirectoryBrowser
                        selectedPath={newProjectPath}
                        onSelect={setNewProjectPath}
                        onError={setError}
                      />
                      <Input
                        placeholder="/absolute/path/to/project"
                        value={newProjectPath}
                        onChange={(event) =>
                          setNewProjectPath(event.target.value)
                        }
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
                  onClick={() => navigate(`/project/${project.id}`)}
                  title={project.name}
                >
                  {project.name}
                </button>
              ))}
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="group-data-[collapsible=icon]:hidden">
          <Button variant="outline" render={<Link to="/settings" />}>
            Settings
          </Button>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-w-0 overflow-hidden">
        <Outlet context={context} />
      </SidebarInset>

      {error && (
        <div className="fixed right-4 bottom-4 rounded-md bg-destructive px-3 py-2 text-xs text-white">
          {error}
        </div>
      )}
    </SidebarProvider>
  )
}
