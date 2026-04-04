import { useEffect, useState } from "react"
import {
  ChevronDownIcon,
  ChevronRightIcon,
  LoaderCircleIcon,
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import {
  createDirectory,
  fetchDirectoryChildren,
  fetchDirectoryRoots,
  type DirectoryNode,
} from "../lib/fs-api"

type DirectoryBrowserProps = {
  selectedPath: string
  onSelect: (path: string) => void
  onError: (message: string) => void
}

export function DirectoryBrowser({
  selectedPath,
  onSelect,
  onError,
}: DirectoryBrowserProps) {
  const [roots, setRoots] = useState<DirectoryNode[]>([])
  const [showHidden, setShowHidden] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [childrenByPath, setChildrenByPath] = useState<
    Record<string, DirectoryNode[]>
  >({})
  const [loadingByPath, setLoadingByPath] = useState<Record<string, boolean>>(
    {}
  )
  const [loadingRoots, setLoadingRoots] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    setLoadingRoots(true)
    fetchDirectoryRoots()
      .then((roots) => {
        setRoots(roots)
      })
      .catch((cause) => onError(String(cause)))
      .finally(() => setLoadingRoots(false))
  }, [onError])

  useEffect(() => {
    setExpanded({})
    setChildrenByPath({})
  }, [showHidden])

  async function loadChildren(path: string) {
    setLoadingByPath((current) => ({ ...current, [path]: true }))

    try {
      const children = await fetchDirectoryChildren(path, showHidden)
      setChildrenByPath((current) => ({ ...current, [path]: children }))
    } catch (cause) {
      onError(String(cause))
    } finally {
      setLoadingByPath((current) => ({ ...current, [path]: false }))
    }
  }

  async function toggle(path: string) {
    const isExpanded = Boolean(expanded[path])

    if (isExpanded) {
      setExpanded((current) => ({ ...current, [path]: false }))
      return
    }

    const hasLoadedChildren = Object.prototype.hasOwnProperty.call(
      childrenByPath,
      path
    )
    if (hasLoadedChildren === false) {
      await loadChildren(path)
    }

    setExpanded((current) => ({ ...current, [path]: true }))
  }

  async function createFolder() {
    if (!selectedPath || !newFolderName.trim() || creating) {
      return
    }

    setCreating(true)
    try {
      await createDirectory(selectedPath, newFolderName.trim())

      setNewFolderName("")
      await loadChildren(selectedPath)
      setExpanded((current) => ({ ...current, [selectedPath]: true }))
    } catch (cause) {
      onError(String(cause))
    } finally {
      setCreating(false)
    }
  }

  function renderNode(node: DirectoryNode, level: number) {
    const isExpanded = Boolean(expanded[node.path])
    const isLoading = Boolean(loadingByPath[node.path])
    const children = childrenByPath[node.path] || []
    const isSelected = selectedPath === node.path

    return (
      <div key={node.path} className="flex flex-col gap-1">
        <div className="flex items-center gap-1">
          <button
            className="inline-flex size-6 items-center justify-center rounded hover:bg-muted"
            onClick={() => void toggle(node.path)}
            type="button"
          >
            {isLoading ? (
              <LoaderCircleIcon className="animate-spin" />
            ) : isExpanded ? (
              <ChevronDownIcon />
            ) : (
              <ChevronRightIcon />
            )}
          </button>
          <button
            className={`flex-1 truncate rounded px-2 py-1 text-left text-sm ${
              isSelected
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted"
            }`}
            onClick={() => onSelect(node.path)}
            style={{ paddingLeft: `${level * 12 + 8}px` }}
            title={node.path}
            type="button"
          >
            {node.name}
          </button>
        </div>
        {isExpanded && children.length > 0 && (
          <div className="flex flex-col gap-1">
            {children.map((child) => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Browse directories (lazy loading)
        </p>
        <Button
          variant="ghost"
          onClick={() => setShowHidden((current) => current === false)}
        >
          {showHidden ? "Hide Hidden" : "Show Hidden"}
        </Button>
      </div>
      <ScrollArea className="h-72 rounded-2xl border border-border bg-card p-2 shadow-[0_0_0_1px_#f0eee6,0_4px_24px_rgb(0_0_0_/_5%)]">
        {loadingRoots && (
          <p className="text-sm text-muted-foreground">Loading roots...</p>
        )}
        {!loadingRoots && roots.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No root directories available.
          </p>
        )}
        {!loadingRoots && roots.length > 0 && (
          <div className="flex flex-col gap-1">
            {roots.map((root) => renderNode(root, 0))}
          </div>
        )}
      </ScrollArea>
      <div className="flex gap-2">
        <Input
          placeholder={
            selectedPath ? "New folder name" : "Select directory first"
          }
          value={newFolderName}
          onChange={(event) => setNewFolderName(event.target.value)}
          disabled={!selectedPath || creating}
        />
        <Button
          onClick={() => void createFolder()}
          disabled={!selectedPath || !newFolderName.trim() || creating}
        >
          New Folder
        </Button>
      </div>
    </div>
  )
}
