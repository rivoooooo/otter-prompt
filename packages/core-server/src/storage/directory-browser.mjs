import { lstat, readdir } from "node:fs/promises"
import { homedir } from "node:os"
import { basename, dirname, join, resolve } from "node:path"

function isHiddenDirectory(name) {
  return name.startsWith(".")
}

async function isExistingDirectory(path) {
  try {
    const stat = await lstat(path)
    return stat.isDirectory()
  } catch {
    return false
  }
}

function normalizeDirectoryPath(path) {
  return resolve(path)
}

function createNode(path, label) {
  return {
    path,
    name: label || basename(path) || path,
    hasChildren: true,
  }
}

export async function listDirectoryRoots(projects = []) {
  const homePath = normalizeDirectoryPath(homedir())

  const candidates = [
    homePath,
    ...projects.map((project) => project.localPath || ""),
    ...projects.map((project) => dirname(project.localPath || "")),
  ]
    .filter(Boolean)
    .map((path) => normalizeDirectoryPath(path))

  const uniquePaths = Array.from(new Set(candidates))
  const existing = []

  for (const path of uniquePaths) {
    if (await isExistingDirectory(path)) {
      existing.push(path)
    }
  }

  const nodes = existing.map((path) =>
    createNode(path, path === homePath ? "~" : undefined),
  )

  return nodes.sort((a, b) => a.name.localeCompare(b.name))
}

export async function listDirectoryChildren(path, options = {}) {
  const showHidden = Boolean(options.showHidden)
  const targetPath = normalizeDirectoryPath(path)

  const entries = await readdir(targetPath, { withFileTypes: true })
  const children = []

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      continue
    }

    if (!showHidden && isHiddenDirectory(entry.name)) {
      continue
    }

    children.push(createNode(join(targetPath, entry.name)))
  }

  return children.sort((a, b) => a.name.localeCompare(b.name))
}
