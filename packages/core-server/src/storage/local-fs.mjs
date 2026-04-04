import { readdir, readFile, stat, mkdir, writeFile, rm } from "node:fs/promises"
import { basename, dirname, join, resolve } from "node:path"

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

export async function deletePath(path) {
  await rm(resolve(path), { recursive: true, force: true })
}
