import { randomUUID } from "node:crypto"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"

const CHAT_UPLOAD_TTL_MS = 1000 * 60 * 30
const CHAT_UPLOAD_DIR = join(tmpdir(), "otter-prompt-ai", "chat-uploads")
const uploadRecords = new Map()

const TEXT_LIKE_MEDIA_TYPES = new Set([
  "application/javascript",
  "application/json",
  "application/ld+json",
  "application/sql",
  "application/xml",
  "application/yaml",
  "application/x-sh",
  "image/svg+xml",
  "text/csv",
  "text/html",
  "text/javascript",
  "text/markdown",
  "text/plain",
  "text/xml",
])

const TEXT_LIKE_EXTENSIONS = new Set([
  "c",
  "cc",
  "cpp",
  "css",
  "csv",
  "go",
  "html",
  "java",
  "js",
  "json",
  "jsx",
  "md",
  "mjs",
  "php",
  "py",
  "rb",
  "rs",
  "sh",
  "sql",
  "svg",
  "toml",
  "ts",
  "tsx",
  "txt",
  "xml",
  "yaml",
  "yml",
])

function sanitizeFilename(filename) {
  const nextFilename = String(filename || "attachment")
    .replace(/[/\\?%*:|"<>]/g, "-")
    .trim()

  return nextFilename || "attachment"
}

function normalizeMediaType(filename, mediaType) {
  const normalizedMediaType = String(mediaType || "").trim().toLowerCase()
  if (normalizedMediaType) {
    return normalizedMediaType
  }

  const extension = getExtension(filename)
  if (TEXT_LIKE_EXTENSIONS.has(extension)) {
    return "text/plain"
  }

  return "application/octet-stream"
}

function getExtension(filename) {
  return String(filename || "").split(".").pop()?.toLowerCase() || ""
}

function getAttachmentKind(mediaType, filename) {
  if (String(mediaType || "").startsWith("image/")) {
    return "image"
  }

  if (
    String(mediaType || "").startsWith("text/") ||
    TEXT_LIKE_MEDIA_TYPES.has(String(mediaType || "")) ||
    TEXT_LIKE_EXTENSIONS.has(getExtension(filename))
  ) {
    return "text"
  }

  return "binary"
}

async function ensureUploadDirectory() {
  await mkdir(CHAT_UPLOAD_DIR, { recursive: true })
}

async function removeUploadRecord(record) {
  uploadRecords.delete(record.id)

  try {
    await rm(record.storagePath, { force: true })
  } catch {
    // Ignore cleanup failures for expired temp files.
  }
}

async function cleanupExpiredUploads() {
  const now = Date.now()
  const expiredRecords = [...uploadRecords.values()].filter(
    (record) => record.expiresAt <= now
  )

  await Promise.all(expiredRecords.map((record) => removeUploadRecord(record)))
}

function toPublicUpload(record) {
  return {
    id: record.id,
    filename: record.filename,
    mediaType: record.mediaType,
    size: record.size,
    kind: record.kind,
    expiresAt: new Date(record.expiresAt).toISOString(),
  }
}

export async function storeChatUploads(files) {
  await cleanupExpiredUploads()
  await ensureUploadDirectory()

  const uploads = []

  for (const file of files) {
    const filename = sanitizeFilename(file.name)
    const mediaType = normalizeMediaType(filename, file.type)
    const buffer = Buffer.from(await file.arrayBuffer())
    const id = randomUUID()
    const storagePath = join(CHAT_UPLOAD_DIR, id)
    const expiresAt = Date.now() + CHAT_UPLOAD_TTL_MS
    const record = {
      id,
      storagePath,
      filename,
      mediaType,
      size: buffer.byteLength,
      kind: getAttachmentKind(mediaType, filename),
      expiresAt,
    }

    await writeFile(storagePath, buffer)
    uploadRecords.set(id, record)
    uploads.push(toPublicUpload(record))
  }

  return uploads
}

export async function getChatUploadRecord(uploadId) {
  await cleanupExpiredUploads()

  const record = uploadRecords.get(String(uploadId || ""))
  if (!record) {
    return null
  }

  if (record.expiresAt <= Date.now()) {
    await removeUploadRecord(record)
    return null
  }

  return record
}

export async function readChatUploadBuffer(uploadId) {
  const record = await getChatUploadRecord(uploadId)
  if (!record) {
    return null
  }

  return {
    record,
    buffer: await readFile(record.storagePath),
  }
}

export async function readChatUploadText(uploadId) {
  const payload = await readChatUploadBuffer(uploadId)
  if (!payload) {
    return null
  }

  return {
    record: payload.record,
    text: payload.buffer.toString("utf8"),
  }
}

export async function readChatUploadDataUrl(uploadId) {
  const payload = await readChatUploadBuffer(uploadId)
  if (!payload) {
    return null
  }

  return {
    record: payload.record,
    dataUrl: `data:${payload.record.mediaType};base64,${payload.buffer.toString("base64")}`,
  }
}
