import { Link, Outlet, useLocation, useNavigate, useParams } from "react-router"
import { useEffect, useMemo, useState } from "react"
import { FolderOpenIcon, PlusIcon } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog"
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
import { DirectoryBrowser } from "../components/directory-browser"
import { apiRequest } from "../lib/api-client"
import { getAppSettings } from "../lib/app-settings"
import {
  fetchFile,
  fetchTree,
  removePath,
  saveFile,
  type TreeNode,
} from "../lib/fs-api"

type Project = {
  id: string
  name: string
  localPath: string
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

export type WorkspaceShellContext = {
  activeFile: string
  fileContent: string
  hasActiveFile: boolean
  syncStatus: SyncStatus | null
  error: string
  setError: (message: string) => void
  setFileContent: (value: string) => void
  saveActiveFile: () => Promise<void>
  deleteActiveFile: () => Promise<void>
}

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
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "hover:bg-sidebar-accent"
        }`}
        onClick={() => onSelect(node)}
      >
        {node.name}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <p className="truncate px-2 text-xs text-sidebar-foreground/70">
        {node.name}
      </p>
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

export default function WorkspaceRoute() {
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams()

  const [projects, setProjects] = useState<Project[]>([])
  const [tree, setTree] = useState<TreeNode | null>(null)
  const [newProjectPath, setNewProjectPath] = useState("")
  const [addProjectDialogOpen, setAddProjectDialogOpen] = useState(false)
  const [activeFile, setActiveFile] = useState("")
  const [fileContent, setFileContent] = useState("")
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [error, setError] = useState("")

  const hasActiveFile = useMemo(() => Boolean(activeFile), [activeFile])
  const activeProject = useMemo(
    () => projects.find((project) => project.id === params.projectId) || null,
    [projects, params.projectId]
  )

  useEffect(() => {
    apiRequest<{ projects: Project[] }>("/projects")
      .then((body) => {
        setProjects(body.projects)
      })
      .catch((cause) => setError(String(cause)))
  }, [])

  useEffect(() => {
    if (
      location.pathname.startsWith("/projects/") &&
      params.projectId &&
      projects.length > 0 &&
      !activeProject
    ) {
      navigate(`/projects/${projects[0].id}`, { replace: true })
    }
  }, [location.pathname, params.projectId, projects, activeProject, navigate])

  useEffect(() => {
    if (!activeProject?.localPath) {
      setTree(null)
      setActiveFile("")
      setFileContent("")
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

    apiRequest<SyncStatus>(
      `/sync/status?projectId=${encodeURIComponent(activeProject.id)}`
    )
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

  async function saveActiveFile() {
    if (!activeFile) {
      return
    }

    await saveFile(activeFile, fileContent)
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

    const settings = getAppSettings()

    const body = await apiRequest<{ project: Project }>(`/projects`, {
      method: "POST",
      body: JSON.stringify({
        localPath: newProjectPath,
        name: newProjectPath.split("/").filter(Boolean).pop() || "Project",
        allowDuplicateLocalPath:
          settings.general.allowDuplicateLocalPathAsNewProject,
      }),
    })

    setProjects((current) => {
      if (current.some((project) => project.id === body.project.id)) {
        return current
      }

      return [body.project, ...current]
    })

    setNewProjectPath("")
    navigate(`/projects/${body.project.id}`)
  }

  const context: WorkspaceShellContext = {
    activeFile,
    fileContent,
    hasActiveFile,
    syncStatus,
    error,
    setError,
    setFileContent,
    saveActiveFile,
    deleteActiveFile,
  }

  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <span className="truncate font-medium group-data-[collapsible=icon]:hidden">
              Projects
            </span>
          </div>
        </SidebarHeader>

        <SidebarSeparator />

        <SidebarContent>
          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <div className="flex items-center justify-between px-2">
              <SidebarGroupLabel className="h-auto px-0 py-0">
                Project List
              </SidebarGroupLabel>
              <Dialog
                open={addProjectDialogOpen}
                onOpenChange={setAddProjectDialogOpen}
              >
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
                      Default roots include <code>~</code> and your used project
                      directories.
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
            <SidebarGroupContent className="flex flex-col gap-1">
              {projects.map((project) => (
                <button
                  key={project.id}
                  className={`truncate rounded-md px-2 py-1.5 text-left text-sm group-data-[collapsible=icon]:text-center ${
                    activeProject?.id === project.id
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "hover:bg-sidebar-accent"
                  }`}
                  onClick={() => navigate(`/projects/${project.id}`)}
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
                  <FileTree
                    node={tree}
                    activeFile={activeFile}
                    onSelect={loadFile}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {projects.length === 0
                      ? "No projects yet. Add one from above."
                      : "Open a project to browse files."}
                  </p>
                )}
              </ScrollArea>
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

      <SidebarInset>
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
