import { Link } from "react-router"
import { useEffect, useMemo, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { apiRequest, apiStream } from "../lib/api-client"

type Project = {
  id: string
  name: string
  localPath: string
  lastSyncedAt?: string | null
}

type TreeNode = {
  type: "directory" | "file"
  name: string
  path: string
  children?: TreeNode[]
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

function FileTree({
  node,
  onSelect,
}: {
  node: TreeNode
  onSelect: (node: TreeNode) => void
}) {
  if (node.type === "file") {
    return (
      <button
        className="block w-full truncate rounded px-2 py-1 text-left text-sm hover:bg-zinc-100"
        onClick={() => onSelect(node)}
      >
        {node.name}
      </button>
    )
  }

  return (
    <div className="space-y-1">
      <p className="px-2 text-xs font-medium uppercase text-zinc-500">{node.name}</p>
      <div className="space-y-1 border-l border-zinc-200 pl-3">
        {(node.children || []).map((child) => (
          <FileTree key={child.path} node={child} onSelect={onSelect} />
        ))}
      </div>
    </div>
  )
}

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([])
  const [activeProject, setActiveProject] = useState<Project | null>(null)
  const [tree, setTree] = useState<TreeNode | null>(null)
  const [newProjectPath, setNewProjectPath] = useState("")
  const [activeFile, setActiveFile] = useState<string>("")
  const [content, setContent] = useState("")
  const [editorCommand, setEditorCommand] = useState("")
  const [chatInput, setChatInput] = useState("")
  const [chatOutput, setChatOutput] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [error, setError] = useState("")

  const canSave = useMemo(() => Boolean(activeFile), [activeFile])

  useEffect(() => {
    setApiKey(window.localStorage.getItem("otter.apiKey") || "")
  }, [])

  useEffect(() => {
    window.localStorage.setItem("otter.apiKey", apiKey)
  }, [apiKey])

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

    apiRequest<{ tree: TreeNode }>(
      `/tree?projectPath=${encodeURIComponent(activeProject.localPath)}`,
    )
      .then((body) => setTree(body.tree))
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
    const body = await apiRequest<{ content: string }>(
      `/file?path=${encodeURIComponent(node.path)}`,
    )
    setContent(body.content)
  }

  async function saveFile() {
    if (!activeFile) {
      return
    }

    await apiRequest(`/file`, {
      method: "PUT",
      body: JSON.stringify({ path: activeFile, content }),
    })
  }

  async function openInEditor(path: string) {
    await apiRequest(`/editor/open`, {
      method: "POST",
      body: JSON.stringify({ path, command: editorCommand || undefined }),
    })
  }

  async function runChat() {
    setChatOutput("")
    const response = await apiStream("/chat/stream", { message: chatInput }, { apiKey })

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

        const payload = event.slice(6)
        const parsed = JSON.parse(payload)
        setChatOutput((current) => current + (parsed.chunk || ""))
      }
    }
  }

  async function addProject() {
    if (!newProjectPath) {
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

  return (
    <div className="grid min-h-svh grid-cols-12 bg-zinc-50 text-zinc-900">
      <aside className="col-span-3 border-r border-zinc-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Projects</h2>
          <Button size="xs" variant="outline" render={<Link to="/settings" />}>
            Settings
          </Button>
        </div>
        <div className="mb-3 flex gap-1">
          <Input
            className="h-8 text-xs"
            placeholder="/absolute/path/to/project"
            value={newProjectPath}
            onChange={(event) => setNewProjectPath(event.target.value)}
          />
          <Button size="xs" onClick={() => addProject().catch((cause) => setError(String(cause)))}>
            Add
          </Button>
        </div>
        <div className="space-y-1">
          {projects.map((project) => (
            <button
              key={project.id}
              className={`w-full rounded px-2 py-1 text-left text-sm ${
                activeProject?.id === project.id ? "bg-zinc-900 text-white" : "hover:bg-zinc-100"
              }`}
              onClick={() => setActiveProject(project)}
            >
              {project.name}
            </button>
          ))}
        </div>
        {tree && (
          <div className="mt-4 max-h-[60svh] overflow-auto">
            <FileTree node={tree} onSelect={loadFile} />
          </div>
        )}
      </aside>

      <main className="col-span-6 flex flex-col border-r border-zinc-200 bg-white p-3">
        <div className="mb-2 flex items-center gap-2 text-xs">
          <Input
            className="h-8 w-56"
            placeholder="API key (browser only)"
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
          />
          <Button size="xs" onClick={() => syncPush().catch((cause) => setError(String(cause)))}>
            Push
          </Button>
          <Button size="xs" onClick={() => syncPull().catch((cause) => setError(String(cause)))}>
            Pull
          </Button>
          <Input
            className="h-8 w-64"
            placeholder="Custom editor command"
            value={editorCommand}
            onChange={(event) => setEditorCommand(event.target.value)}
          />
          <Button
            size="xs"
            variant="outline"
            onClick={() => openInEditor(activeFile || activeProject?.localPath || "")}
            disabled={!activeFile && !activeProject?.localPath}
          >
            Open External
          </Button>
          <Button size="xs" onClick={saveFile} disabled={!canSave}>
            Save
          </Button>
        </div>

        <p className="mb-2 truncate text-xs text-zinc-500">{activeFile || "No file selected"}</p>
        <p className="mb-2 truncate text-[11px] text-zinc-500">
          Last sync: {syncStatus?.local?.lastSyncedAt || "never"} | Cloud rev: {syncStatus?.cloud?.revision ?? 0} |
          Conflicts: {syncStatus?.local?.conflicts?.length || 0}
        </p>
        <textarea
          className="h-full w-full resize-none rounded border border-zinc-200 p-3 font-mono text-sm"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Select a file from the tree..."
        />
      </main>

      <section className="col-span-3 flex flex-col bg-white p-3">
        <h2 className="mb-2 text-sm font-semibold">AI Test</h2>
        <textarea
          className="h-24 w-full resize-none rounded border border-zinc-200 p-2 text-sm"
          placeholder="Ask the model to test your prompt..."
          value={chatInput}
          onChange={(event) => setChatInput(event.target.value)}
        />
        <Button className="mt-2" size="sm" onClick={() => runChat().catch((cause) => setError(String(cause)))}>
          Run
        </Button>
        <pre className="mt-3 h-full overflow-auto rounded border border-zinc-200 bg-zinc-50 p-2 text-xs whitespace-pre-wrap">
          {chatOutput || "Streaming output..."}
        </pre>
      </section>

      {error && (
        <div className="fixed right-4 bottom-4 rounded bg-red-600 px-3 py-2 text-xs text-white">{error}</div>
      )}
    </div>
  )
}
