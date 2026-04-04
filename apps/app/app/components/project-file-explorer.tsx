import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react"
import {
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
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
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
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
} from "@workspace/ui/components/sidebar"
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

  function setPathExpanded(path: string, isExpanded: boolean) {
    setExpandedPaths((current) => ({
      ...current,
      [path]: isExpanded,
    }))
  }

  function renderActionMenu(node: TreeNode, canDeleteOrRename: boolean) {
    const canCreateChildren = node.type === "directory"

    if (!canCreateChildren && !canDeleteOrRename) {
      return null
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <SidebarMenuAction
              showOnHover
              aria-label={`${node.name} actions`}
            />
          }
        >
          <EllipsisIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44 min-w-44">
          <DropdownMenuGroup>
            {canCreateChildren ? (
              <>
                <DropdownMenuItem onClick={() => beginCreate(node.path, "new-file")}>
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
    )
  }

  function renderEditableItem(
    parentPath: string,
    icon: ReactNode,
    value: string,
    placeholder: string,
    onChange: (nextValue: string) => void,
    autoFocus = false
  ) {
    return (
      <SidebarMenuItem key={`draft-${parentPath}`}>
        <SidebarMenuButton
          render={<div />}
          className="h-auto cursor-default items-start gap-2 rounded-[18px] bg-accent/40 px-3 py-2 hover:bg-accent/40 active:bg-accent/40"
        >
          <span className="flex-none text-muted-foreground">{icon}</span>
          <Input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleDraftKeyDown}
            placeholder={placeholder}
            className="h-8 min-w-0 flex-1 bg-background/80"
            disabled={submitting}
            autoFocus={autoFocus}
          />
          <div className="flex flex-none items-center gap-1">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => void submitDraftAction()}
              disabled={!value.trim() || submitting}
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
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  function renderDraftRow(parentPath: string) {
    if (
      !draftAction ||
      draftAction.type === "rename" ||
      draftAction.parentPath !== parentPath
    ) {
      return null
    }

    return renderEditableItem(
      parentPath,
      draftAction.type === "new-folder" ? <FolderOpenIcon /> : <FileIcon />,
      draftAction.value,
      draftAction.type === "new-folder" ? "folder-name" : "file-name.ts",
      (nextValue) =>
        setDraftAction((current) =>
          current && current.parentPath === parentPath
            ? { ...current, value: nextValue }
            : current
        ),
      true
    )
  }

  function renderChildren(node: TreeNode) {
    if (!expandedPaths[node.path]) {
      return null
    }

    return (
      <SidebarMenuSub>
        {renderDraftRow(node.path)}
        {(node.children || []).map((child) => renderNode(child))}
      </SidebarMenuSub>
    )
  }

  function renderRenameRow(node: TreeNode) {
    const isDirectory = node.type === "directory"

    return (
      <SidebarMenuButton
        render={<div />}
        className="h-auto cursor-default items-start gap-2 rounded-[18px] bg-accent/40 px-3 py-2 hover:bg-accent/40 active:bg-accent/40"
      >
        <span className="flex-none text-muted-foreground">
          {isDirectory ? (
            expandedPaths[node.path] ? (
              <FolderOpenIcon />
            ) : (
              <FolderIcon />
            )
          ) : (
            <FileIcon />
          )}
        </span>
        <Input
          value={draftAction?.type === "rename" ? draftAction.value : ""}
          onChange={(event) =>
            setDraftAction((current) =>
              current?.type === "rename" && current.path === node.path
                ? { ...current, value: event.target.value }
                : current
            )
          }
          onKeyDown={handleDraftKeyDown}
          className="h-8 min-w-0 flex-1 bg-background/80"
          disabled={submitting}
          autoFocus
        />
        <div className="flex flex-none items-center gap-1">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => void submitDraftAction()}
            disabled={!draftAction?.value.trim() || submitting}
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
      </SidebarMenuButton>
    )
  }

  function renderNode(node: TreeNode): ReactNode {
    const isDirectory = node.type === "directory"
    const isExpanded = Boolean(expandedPaths[node.path])
    const isRenaming =
      draftAction?.type === "rename" && draftAction.path === node.path
    const isActive = activeFile === node.path
    const isRoot = node.path === tree?.path
    const buttonClassName = cn(
      "min-h-[2.5rem] rounded-[18px] px-[12px] text-[0.95rem] text-foreground hover:bg-accent/70 hover:text-foreground data-[active=true]:bg-accent data-[active=true]:font-medium data-[active=true]:text-foreground",
      isRoot && "font-heading text-base leading-[1.2]"
    )

    if (isRenaming) {
      return (
        <SidebarMenuItem key={node.path}>
          {renderRenameRow(node)}
          {isDirectory ? renderChildren(node) : null}
        </SidebarMenuItem>
      )
    }

    if (isDirectory) {
      return (
        <SidebarMenuItem key={node.path}>
          <Collapsible
            open={isExpanded}
            onOpenChange={(open) => setPathExpanded(node.path, open)}
            className="group/collapsible"
          >
            <CollapsibleTrigger
              render={
                <SidebarMenuButton
                  isActive={isActive}
                  className={buttonClassName}
                  title={node.path}
                />
              }
            >
              <ChevronRightIcon
                className={cn("transition-transform", isExpanded && "rotate-90")}
              />
              {isExpanded ? <FolderOpenIcon /> : <FolderIcon />}
              <span>{node.name}</span>
            </CollapsibleTrigger>
            {!isRoot ? renderActionMenu(node, true) : null}
            <CollapsibleContent>{renderChildren(node)}</CollapsibleContent>
          </Collapsible>
        </SidebarMenuItem>
      )
    }

    return (
      <SidebarMenuItem key={node.path}>
        <SidebarMenuButton
          isActive={isActive}
          className={buttonClassName}
          onClick={() => void onOpenFile(node.path).catch((cause) => onError(String(cause)))}
          title={node.path}
        >
          <FileIcon />
          <span>{node.name}</span>
        </SidebarMenuButton>
        {renderActionMenu(node, true)}
      </SidebarMenuItem>
    )
  }

  return (
    <TooltipProvider delay={120}>
      <div className="flex min-h-full min-w-0 flex-col overflow-hidden">
        <SidebarHeader className="gap-3 p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="font-heading text-[1.45rem] leading-[1.2]">
                Project Explorer
              </h2>
            </div>
            <div className="flex flex-none flex-wrap gap-2">
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
        </SidebarHeader>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col border-t border-border/90 pt-[18px]">
          {!tree ? (
            <div className="flex min-h-40 flex-1 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
              <LoaderCircleIcon className="animate-spin" />
              <p>Loading project tree...</p>
            </div>
          ) : (
            <ScrollArea className="min-h-0 min-w-0 flex-1">
              <SidebarContent className="min-h-full min-w-0 gap-3 overflow-visible pr-[14px] pb-5">
                <SidebarGroup className="p-0">
                  <SidebarGroupLabel className="sr-only">Files</SidebarGroupLabel>
                  <SidebarGroupContent className="flex flex-col gap-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="rounded-full">
                        {projectName}
                      </Badge>
                      <Badge variant="outline" className="rounded-full">
                        {tree.children?.length ?? 0} top-level items
                      </Badge>
                    </div>

                    <SidebarMenu>{renderNode(tree)}</SidebarMenu>

                    {expandedPaths[tree.path] &&
                    (!tree.children || tree.children.length === 0) &&
                    !draftAction ? (
                      <div className="flex min-h-32 flex-1 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                        <p>No files yet. Start with a new file or folder.</p>
                      </div>
                    ) : null}
                  </SidebarGroupContent>
                </SidebarGroup>
              </SidebarContent>
            </ScrollArea>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
