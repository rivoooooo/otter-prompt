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
        className="flex min-h-[34px] min-w-0 items-center gap-1.5 rounded-[14px] bg-[rgb(255_255_255_/_44%)] px-1.5 py-1 transition-[background-color,color] duration-120"
        style={{ paddingLeft: `${level * 14}px` }}
      >
        <span className="inline-flex w-6 flex-none items-center justify-center text-muted-foreground" />
        <span className="inline-flex flex-none items-center justify-center text-muted-foreground">
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
          className="h-8 min-w-0 flex-1 bg-[rgb(255_255_255_/_84%)]"
          disabled={submitting}
          autoFocus
        />
        <div className="flex flex-none items-center gap-1">
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
      <div key={node.path} className="flex flex-col gap-0.5">
        <div className="min-w-0">
          <div
            className={cn(
              "group flex min-h-[34px] min-w-0 items-center gap-1.5 rounded-[14px] px-1.5 py-1 transition-[background-color,color] duration-120 focus-within:bg-[rgb(255_255_255_/_48%)] hover:bg-[rgb(255_255_255_/_48%)]",
              isActive &&
                "bg-[rgb(201_100_66_/_12%)] text-foreground shadow-[inset_0_0_0_1px_rgb(201_100_66_/_20%)]"
            )}
            style={{ paddingLeft: `${level * 14}px` }}
          >
            {isDirectory ? (
              <button
                type="button"
                className="inline-flex h-6 w-6 flex-none items-center justify-center rounded-full text-muted-foreground hover:bg-[rgb(255_255_255_/_56%)] hover:text-foreground"
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
              <span className="inline-flex w-6 flex-none items-center justify-center text-muted-foreground" />
            )}

            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
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
              <span className="inline-flex flex-none items-center justify-center text-muted-foreground">
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
                  className="h-8 min-w-0 flex-1 bg-[rgb(255_255_255_/_84%)]"
                  disabled={submitting}
                  autoFocus
                />
              ) : (
                <span className="truncate">{node.name}</span>
              )}
            </button>

            {isRenaming ? (
              <div className="flex flex-none items-center gap-1">
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
              <div
                className={cn(
                  "flex flex-none items-center transition-opacity duration-120",
                  isActive
                    ? "opacity-100"
                    : "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
                )}
              >
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="text-muted-foreground"
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
          <div className="flex flex-col gap-0.5">
            {renderDraftRow(node.path, level + 1)}
            {(node.children || []).map((child) => renderNode(child, level + 1))}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <TooltipProvider delay={120}>
      <div className="flex min-h-full flex-col p-4 lg:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs tracking-[0.12px] text-muted-foreground">
              Files
            </p>
            <h2 className="font-heading text-[1.45rem] leading-[1.2]">
              Project Explorer
            </h2>
            <p className="mt-2.5 font-mono text-[0.84rem] leading-[1.6] [overflow-wrap:anywhere] text-muted-foreground">
              {projectPath}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
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

        <div className="flex min-h-0 flex-1 flex-col gap-3 border-t border-[rgb(232_230_220_/_92%)] pt-[18px]">
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-[#faf9f5] px-2.5 py-0.5 text-xs text-muted-foreground">
              {projectName}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-[#faf9f5] px-2.5 py-0.5 text-xs text-muted-foreground">
              {tree?.children?.length ?? 0} top-level items
            </span>
          </div>

          {!tree ? (
            <div className="flex min-h-40 flex-1 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
              <LoaderCircleIcon className="animate-spin" />
              <p>Loading project tree...</p>
            </div>
          ) : (
            <ScrollArea className="min-h-0 flex-1">
              <div className="flex flex-col gap-0.5 pr-[14px] pb-5">
                <div className="mb-1">
                  <button
                    type="button"
                    className="inline-flex max-w-full min-w-0 items-center gap-2 rounded-full px-2.5 py-1 font-heading text-base leading-[1.2] text-foreground hover:bg-[rgb(255_255_255_/_52%)]"
                    onClick={() =>
                      setExpandedPaths((current) => ({
                        ...current,
                        [tree.path]: !current[tree.path],
                      }))
                    }
                    title={tree.path}
                  >
                    <span className="inline-flex flex-none items-center justify-center text-muted-foreground">
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
                  <div className="flex min-h-32 flex-1 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
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
