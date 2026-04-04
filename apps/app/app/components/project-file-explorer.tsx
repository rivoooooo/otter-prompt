import { useEffect, useState, type KeyboardEvent } from "react"
import {
  ChevronDownIcon,
  ChevronRightIcon,
  EllipsisIcon,
  FileIcon,
  FolderIcon,
  FolderOpenIcon,
  LoaderCircleIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"
import { createDirectory, saveFile, type TreeNode } from "../lib/fs-api"

type ProjectFileExplorerProps = {
  tree: TreeNode | null
  activeFile: string
  projectName: string
  projectPath: string
  onError: (message: string) => void
  onOpenFile: (path: string) => Promise<void>
  onRefresh: () => Promise<TreeNode | null>
  onRenamePath: (currentPath: string, nextPath: string) => Promise<string>
  onDeletePath: (path: string) => Promise<void>
}

type DraftAction =
  | {
      type: "new-file" | "new-folder"
      parentPath: string
      value: string
    }
  | {
      type: "rename"
      path: string
      parentPath: string
      value: string
    }

function validatePathSegment(name: string, label: string) {
  if (!name.trim()) {
    throw new Error(`${label} is required`)
  }

  if (name.includes("/") || name.includes("\\") || name.includes("..")) {
    throw new Error(`invalid ${label}`)
  }
}

function getPathSeparator(path: string) {
  return path.includes("\\") ? "\\" : "/"
}

function joinChildPath(parentPath: string, name: string) {
  const separator = getPathSeparator(parentPath)
  return parentPath.endsWith(separator)
    ? `${parentPath}${name}`
    : `${parentPath}${separator}${name}`
}

function getParentPath(path: string) {
  const separator = getPathSeparator(path)
  const lastSeparatorIndex = path.lastIndexOf(separator)
  if (lastSeparatorIndex <= 0) {
    return path
  }

  return path.slice(0, lastSeparatorIndex)
}

function isPathWithin(path: string, parentPath: string) {
  return (
    path === parentPath ||
    path.startsWith(`${parentPath}/`) ||
    path.startsWith(`${parentPath}\\`)
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

function treeContainsPath(node: TreeNode, path: string): boolean {
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

export function ProjectFileExplorer({
  tree,
  activeFile,
  projectName,
  projectPath,
  onError,
  onOpenFile,
  onRefresh,
  onRenamePath,
  onDeletePath,
}: ProjectFileExplorerProps) {
  const [expandedPaths, setExpandedPaths] = useState<Record<string, boolean>>(
    {}
  )
  const [draftAction, setDraftAction] = useState<DraftAction | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!tree?.path) {
      setExpandedPaths({})
      return
    }

    setExpandedPaths((current) => {
      if (current[tree.path]) {
        return current
      }

      return { ...current, [tree.path]: true }
    })
  }, [tree?.path])

  function beginCreate(parentPath: string, type: DraftAction["type"]) {
    if (type !== "new-file" && type !== "new-folder") {
      return
    }

    setExpandedPaths((current) => ({ ...current, [parentPath]: true }))
    setDraftAction({ type, parentPath, value: "" })
  }

  function beginRename(node: TreeNode) {
    setDraftAction({
      type: "rename",
      path: node.path,
      parentPath: getParentPath(node.path),
      value: node.name,
    })
  }

  function cancelDraftAction() {
    if (submitting) {
      return
    }

    setDraftAction(null)
  }

  function updateExpandedPaths(currentPath: string, nextPath: string) {
    setExpandedPaths((current) => {
      const nextEntries = Object.entries(current).map(([path, isExpanded]) => [
        rewritePathPrefix(path, currentPath, nextPath),
        isExpanded,
      ])

      return Object.fromEntries(nextEntries)
    })
  }

  async function submitDraftAction() {
    if (!draftAction || !tree || submitting) {
      return
    }

    const nextName = draftAction.value.trim()

    try {
      setSubmitting(true)

      if (draftAction.type === "rename") {
        validatePathSegment(nextName, "file name")

        const nextPath = joinChildPath(draftAction.parentPath, nextName)
        if (nextPath === draftAction.path) {
          setDraftAction(null)
          return
        }

        if (treeContainsPath(tree, nextPath)) {
          throw new Error("path already exists")
        }

        const renamedPath = await onRenamePath(draftAction.path, nextPath)
        updateExpandedPaths(draftAction.path, renamedPath)
        setDraftAction(null)
        return
      }

      validatePathSegment(
        nextName,
        draftAction.type === "new-file" ? "file name" : "directory name"
      )

      const nextPath = joinChildPath(draftAction.parentPath, nextName)
      if (treeContainsPath(tree, nextPath)) {
        throw new Error("path already exists")
      }

      if (draftAction.type === "new-file") {
        await saveFile(nextPath, "")
        await onRefresh()
        await onOpenFile(nextPath)
      } else {
        await createDirectory(draftAction.parentPath, nextName)
        await onRefresh()
        setExpandedPaths((current) => ({
          ...current,
          [draftAction.parentPath]: true,
          [nextPath]: true,
        }))
      }

      setDraftAction(null)
    } catch (cause) {
      onError(String(cause))
    } finally {
      setSubmitting(false)
    }
  }

  async function removePath(path: string) {
    if (submitting) {
      return
    }

    try {
      setSubmitting(true)
      await onDeletePath(path)

      setExpandedPaths((current) =>
        Object.fromEntries(
          Object.entries(current).filter(
            ([entryPath]) => !isPathWithin(entryPath, path)
          )
        )
      )

      if (draftAction) {
        if (
          (draftAction.type === "rename" &&
            isPathWithin(draftAction.path, path)) ||
          isPathWithin(draftAction.parentPath, path)
        ) {
          setDraftAction(null)
        }
      }
    } catch (cause) {
      onError(String(cause))
    } finally {
      setSubmitting(false)
    }
  }

  function handleDraftKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault()
      void submitDraftAction()
      return
    }

    if (event.key === "Escape") {
      event.preventDefault()
      cancelDraftAction()
    }
  }

  function renderDraftRow(parentPath: string, level: number) {
    if (
      !draftAction ||
      draftAction.type === "rename" ||
      draftAction.parentPath !== parentPath
    ) {
      return null
    }

    return (
      <div
        className="app-files-tree-item app-files-tree-item--draft"
        style={{ paddingLeft: `${level * 14}px` }}
      >
        <span className="app-files-tree-spacer" />
        <span className="app-files-tree-icon">
          {draftAction.type === "new-folder" ? (
            <FolderOpenIcon />
          ) : (
            <FileIcon />
          )}
        </span>
        <Input
          value={draftAction.value}
          onChange={(event) =>
            setDraftAction((current) =>
              current && current.parentPath === parentPath
                ? { ...current, value: event.target.value }
                : current
            )
          }
          onKeyDown={handleDraftKeyDown}
          placeholder={
            draftAction.type === "new-folder" ? "folder-name" : "file-name.ts"
          }
          className="app-files-tree-input"
          disabled={submitting}
          autoFocus
        />
        <div className="app-files-tree-inline-actions">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => void submitDraftAction()}
            disabled={!draftAction.value.trim() || submitting}
          >
            Save
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={cancelDraftAction}
            disabled={submitting}
          >
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  function renderNode(node: TreeNode, level: number) {
    const isDirectory = node.type === "directory"
    const isExpanded = Boolean(expandedPaths[node.path])
    const isRenaming =
      draftAction?.type === "rename" && draftAction.path === node.path
    const renameValue = isRenaming ? draftAction.value : ""
    const isActive = activeFile === node.path
    const canDeleteOrRename = node.path !== tree?.path

    return (
      <div key={node.path} className="app-files-tree-branch">
        <div className="app-files-tree-row">
          <div
            className={cn("app-files-tree-item", isActive && "is-active")}
            style={{ paddingLeft: `${level * 14}px` }}
          >
            {isDirectory ? (
              <button
                type="button"
                className="app-files-tree-toggle"
                onClick={() =>
                  setExpandedPaths((current) => ({
                    ...current,
                    [node.path]: !current[node.path],
                  }))
                }
                aria-label={isExpanded ? "Collapse folder" : "Expand folder"}
              >
                {isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
              </button>
            ) : (
              <span className="app-files-tree-spacer" />
            )}

            <button
              type="button"
              className="app-files-tree-label"
              onClick={() =>
                isDirectory
                  ? setExpandedPaths((current) => ({
                      ...current,
                      [node.path]: !current[node.path],
                    }))
                  : void onOpenFile(node.path).catch((cause) =>
                      onError(String(cause))
                    )
              }
              title={node.path}
            >
              <span className="app-files-tree-icon">
                {isDirectory ? (
                  isExpanded ? (
                    <FolderOpenIcon />
                  ) : (
                    <FolderIcon />
                  )
                ) : (
                  <FileIcon />
                )}
              </span>

              {isRenaming ? (
                <Input
                  value={renameValue}
                  onChange={(event) =>
                    setDraftAction((current) =>
                      current?.type === "rename" && current.path === node.path
                        ? { ...current, value: event.target.value }
                        : current
                    )
                  }
                  onKeyDown={handleDraftKeyDown}
                  className="app-files-tree-input"
                  disabled={submitting}
                  autoFocus
                />
              ) : (
                <span className="app-files-tree-name">{node.name}</span>
              )}
            </button>

            {isRenaming ? (
              <div className="app-files-tree-inline-actions">
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => void submitDraftAction()}
                  disabled={!renameValue.trim() || submitting}
                >
                  Save
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={cancelDraftAction}
                  disabled={submitting}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="app-files-tree-actions">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="app-files-tree-menu-button"
                        aria-label={`${node.name} actions`}
                      />
                    }
                  >
                    <EllipsisIcon />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44 min-w-44">
                    <DropdownMenuGroup>
                      {isDirectory ? (
                        <>
                          <DropdownMenuItem
                            onClick={() => beginCreate(node.path, "new-file")}
                          >
                            <PlusIcon />
                            New File
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => beginCreate(node.path, "new-folder")}
                          >
                            <FolderOpenIcon />
                            New Folder
                          </DropdownMenuItem>
                        </>
                      ) : null}
                      {canDeleteOrRename ? (
                        <DropdownMenuItem onClick={() => beginRename(node)}>
                          <PencilIcon />
                          Rename
                        </DropdownMenuItem>
                      ) : null}
                      {canDeleteOrRename ? (
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => void removePath(node.path)}
                        >
                          <Trash2Icon />
                          Delete
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </div>

        {isDirectory && isExpanded ? (
          <div className="app-files-tree-children">
            {renderDraftRow(node.path, level + 1)}
            {(node.children || []).map((child) => renderNode(child, level + 1))}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <TooltipProvider delay={120}>
      <div className="app-module-view">
        <div className="app-toolbar">
          <div>
            <p className="text-xs tracking-[0.12px] text-muted-foreground">
              Files
            </p>
            <h2 className="font-heading text-[1.45rem] leading-[1.2]">
              Project Explorer
            </h2>
            <p className="app-editor-path">{projectPath}</p>
          </div>
          <div className="app-toolbar-actions">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="New file"
                    onClick={() => tree && beginCreate(tree.path, "new-file")}
                    disabled={!tree || submitting}
                  />
                }
              >
                <PlusIcon />
              </TooltipTrigger>
              <TooltipContent>New File</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="New folder"
                    onClick={() => tree && beginCreate(tree.path, "new-folder")}
                    disabled={!tree || submitting}
                  />
                }
              >
                <FolderOpenIcon />
              </TooltipTrigger>
              <TooltipContent>New Folder</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Refresh files"
                    onClick={() =>
                      void onRefresh().catch((cause) => onError(String(cause)))
                    }
                    disabled={!tree || submitting}
                  />
                }
              >
                <RefreshCwIcon />
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="app-files-shell">
          <div className="app-files-summary">
            <span className="app-pill">{projectName}</span>
            <span className="app-pill">
              {tree?.children?.length ?? 0} top-level items
            </span>
          </div>

          {!tree ? (
            <div className="app-files-empty">
              <LoaderCircleIcon className="animate-spin" />
              <p>Loading project tree...</p>
            </div>
          ) : (
            <ScrollArea className="app-files-scroll">
              <div className="app-files-scroll-inner">
                <div className="app-files-root-row">
                  <button
                    type="button"
                    className="app-files-root-label"
                    onClick={() =>
                      setExpandedPaths((current) => ({
                        ...current,
                        [tree.path]: !current[tree.path],
                      }))
                    }
                    title={tree.path}
                  >
                    <span className="app-files-tree-icon">
                      {expandedPaths[tree.path] ? (
                        <FolderOpenIcon />
                      ) : (
                        <FolderIcon />
                      )}
                    </span>
                    <span>{tree.name}</span>
                  </button>
                </div>

                {expandedPaths[tree.path] ? renderDraftRow(tree.path, 1) : null}

                {expandedPaths[tree.path] &&
                tree.children &&
                tree.children.length > 0
                  ? tree.children.map((child) => renderNode(child, 1))
                  : null}

                {expandedPaths[tree.path] &&
                (!tree.children || tree.children.length === 0) &&
                !draftAction ? (
                  <div className="app-files-empty app-files-empty--inline">
                    <p>No files yet. Start with a new file or folder.</p>
                  </div>
                ) : null}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
