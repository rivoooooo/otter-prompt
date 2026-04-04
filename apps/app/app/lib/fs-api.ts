import { apiRequest } from "./api-client"

export type TreeNode = {
  type: "directory" | "file"
  name: string
  path: string
  children?: TreeNode[]
}

export type DirectoryNode = {
  path: string
  name: string
  hasChildren: boolean
}

export async function fetchTree(projectPath: string) {
  const body = await apiRequest<{ tree: TreeNode }>(
    `/tree?projectPath=${encodeURIComponent(projectPath)}`,
  )
  return body.tree
}

export async function fetchFile(path: string) {
  const body = await apiRequest<{ content: string }>(
    `/file?path=${encodeURIComponent(path)}`,
  )
  return body.content
}

export async function saveFile(path: string, content: string) {
  await apiRequest(`/file`, {
    method: "PUT",
    body: JSON.stringify({ path, content }),
  })
}

export async function removePath(path: string) {
  await apiRequest(`/file?path=${encodeURIComponent(path)}`, {
    method: "DELETE",
  })
}

export async function fetchDirectoryRoots() {
  const body = await apiRequest<{ roots: DirectoryNode[] }>(
    "/dialog/directories/roots",
  )
  return body.roots || []
}

export async function fetchDirectoryChildren(path: string, showHidden = false) {
  const body = await apiRequest<{ path: string; children: DirectoryNode[] }>(
    `/dialog/directories/children?path=${encodeURIComponent(path)}&showHidden=${showHidden ? "1" : "0"}`,
  )
  return body.children || []
}

export async function createDirectory(parentPath: string, name: string) {
  const body = await apiRequest<{ path: string; name: string }>("/fs/directory", {
    method: "POST",
    body: JSON.stringify({ parentPath, name }),
  })
  return body
}
