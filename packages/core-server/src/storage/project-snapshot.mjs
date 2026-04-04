import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises"
import { basename, dirname, extname, join, relative, resolve } from "node:path"
import { sha256 } from "./state-store.mjs"

function isTextFile(path) {
  const ext = extname(path).toLowerCase()
  const binaryExt = new Set([
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".ico",
    ".pdf",
    ".zip",
    ".gz",
    ".woff",
    ".woff2",
    ".ttf",
    ".mp3",
    ".mp4",
  ])
  return !binaryExt.has(ext)
}

async function walk(root, current, output) {
  const entries = await readdir(current, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name === ".git") {
      continue
    }

    const abs = join(current, entry.name)
    if (entry.isDirectory()) {
      await walk(root, abs, output)
      continue
    }

    const rel = relative(root, abs)
    const buffer = await readFile(abs)
    const text = isTextFile(abs)
    output.push({
      path: rel,
      kind: text ? "text" : "binary",
      encoding: text ? "utf8" : "base64",
      content: text ? buffer.toString("utf8") : buffer.toString("base64"),
      hash: sha256(buffer),
      size: (await stat(abs)).size,
    })
  }
}

export async function buildSnapshot(projectPath) {
  const root = resolve(projectPath)
  const files = []
  await walk(root, root, files)
  return files
}

function conflictPath(root, relPath) {
  const now = new Date().toISOString().replace(/[.:]/g, "-")
  const ext = extname(relPath)
  const name = basename(relPath, ext)
  const dir = dirname(relPath)
  return join(root, dir, `${name}.conflict-${now}${ext}`)
}

export async function applySnapshot({ projectPath, incomingFiles, previousHashes }) {
  const root = resolve(projectPath)
  const nextHashes = { ...(previousHashes || {}) }
  const conflicts = []

  for (const file of incomingFiles) {
    const abs = resolve(root, file.path)
    await mkdir(dirname(abs), { recursive: true })

    let currentHash = null
    try {
      const currentBuffer = await readFile(abs)
      currentHash = sha256(currentBuffer)
    } catch {
      currentHash = null
    }

    const previousHash = previousHashes?.[file.path] || null
    const hasLocalChanges = currentHash && previousHash && currentHash !== previousHash
    const hasRemoteChanges = file.hash !== previousHash

    if (hasLocalChanges && hasRemoteChanges) {
      const conflictAbs = conflictPath(root, file.path)
      const raw =
        file.encoding === "base64"
          ? Buffer.from(file.content, "base64")
          : Buffer.from(file.content, "utf8")
      await writeFile(conflictAbs, raw)
      conflicts.push({ path: file.path, conflictFile: conflictAbs })
      nextHashes[file.path] = previousHash
      continue
    }

    const raw =
      file.encoding === "base64"
        ? Buffer.from(file.content, "base64")
        : Buffer.from(file.content, "utf8")
    await writeFile(abs, raw)
    nextHashes[file.path] = file.hash
  }

  return { nextHashes, conflicts }
}
