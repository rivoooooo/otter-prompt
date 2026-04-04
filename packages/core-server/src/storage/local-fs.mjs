import {
  access,
  mkdir,
  readFile,
  readdir,
  rename as renameFileSystemPath,
  rm,
  stat,
  writeFile,
} from "node:fs/promises"
import { basename, dirname, join, resolve, sep } from "node:path"

async function buildTree(path) {
  const entries = await readdir(path, { withFileTypes: true })
  const children = []

  for (const entry of entries) {
    if (entry.name === ".git") {
      continue
    }

    const fullPath = join(path, entry.name)
    if (entry.isDirectory()) {
      children.push({
        type: "directory",
        name: entry.name,
        path: fullPath,
        children: await buildTree(fullPath),
      })
      continue
    }

    children.push({
      type: "file",
      name: entry.name,
      path: fullPath,
      size: (await stat(fullPath)).size,
    })
  }

  return children
}

export async function listTree(projectPath) {
  const root = resolve(projectPath)
  return {
    type: "directory",
    name: basename(root),
    path: root,
    children: await buildTree(root),
  }
}

export async function readTextFile(path) {
  return readFile(resolve(path), "utf8")
}

export async function writeTextFile(path, content) {
  const filePath = resolve(path)
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, content, "utf8")
}

function assertPathSegment(name, label) {
  if (typeof name !== "string" || !name.trim()) {
    throw new Error(`${label} is required`)
  }

  if (name.includes("/") || name.includes("\\") || name.includes("..")) {
    throw new Error(`invalid ${label}`)
  }
}

export async function deletePath(path) {
  await rm(resolve(path), { recursive: true, force: true })
}

function assertDirectoryName(name) {
  assertPathSegment(name, "directory name")
}

export async function createDirectory(parentPath, name) {
  assertDirectoryName(name)

  const parent = resolve(parentPath)
  const target = resolve(join(parent, name))
  if (target !== parent && !target.startsWith(parent + sep)) {
    throw new Error("invalid parent path")
  }

  await mkdir(target)
  return target
}

export async function renamePath(fromPath, toPath) {
  if (typeof fromPath !== "string" || !fromPath.trim()) {
    throw new Error("fromPath is required")
  }
  if (typeof toPath !== "string" || !toPath.trim()) {
    throw new Error("toPath is required")
  }

  const currentPath = resolve(fromPath)
  const nextPath = resolve(toPath)
  const currentDirectory = dirname(currentPath)
  const nextDirectory = dirname(nextPath)

  if (currentDirectory !== nextDirectory) {
    throw new Error("renaming across directories is not supported")
  }

  assertPathSegment(basename(nextPath), "file name")

  if (currentPath === nextPath) {
    return nextPath
  }

  try {
    await access(nextPath)
    throw new Error("path already exists")
  } catch (error) {
    if (error instanceof Error && error.message === "path already exists") {
      throw error
    }

    if (error && typeof error === "object" && error.code !== "ENOENT") {
      throw error
    }
  }

  await renameFileSystemPath(currentPath, nextPath)
  return nextPath
}
