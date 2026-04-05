import { DefaultChatTransport } from "ai"
import { getServiceBaseUrl } from "../../lib/service-base-url"
import type {
  PlaygroundMessagePart,
  PlaygroundRenderableAttachment,
  PlaygroundUIMessage,
  PlaygroundUploadKind,
  PlaygroundUploadRef,
} from "./types"

type UploadRefPart = Extract<PlaygroundMessagePart, { type: "data-upload-ref" }>

type UploadApiRecord = Omit<PlaygroundUploadRef, "url" | "uploadId"> & {
  id: string
}

export type ComposerAttachment = {
  id: string
  file: File
  kind: PlaygroundUploadKind
  preview: PlaygroundRenderableAttachment
}

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
  "mjs",
  "md",
  "markdown",
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

function nextId() {
  return (
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  )
}

function getNormalizedServiceBaseUrl() {
  return getServiceBaseUrl().replace(/\/+$/, "")
}

export function isRunningStatus(status: string) {
  return status === "submitted" || status === "streaming"
}

export function isImageMediaType(mediaType: string) {
  return String(mediaType || "").startsWith("image/")
}

function isTextLikeMediaType(mediaType: string) {
  const normalizedMediaType = String(mediaType || "").toLowerCase()
  return (
    normalizedMediaType.startsWith("text/") ||
    TEXT_LIKE_MEDIA_TYPES.has(normalizedMediaType)
  )
}

function isTextLikeFile(file: File) {
  if (isTextLikeMediaType(file.type)) {
    return true
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || ""
  return TEXT_LIKE_EXTENSIONS.has(extension)
}

function buildMediaType(file: File) {
  if (file.type) {
    return file.type
  }

  if (isTextLikeFile(file)) {
    return "text/plain"
  }

  return "application/octet-stream"
}

function getAttachmentKind(mediaType: string) {
  if (isImageMediaType(mediaType)) {
    return "image"
  }

  if (isTextLikeMediaType(mediaType)) {
    return "text"
  }

  return "binary"
}

function toUploadUrl(uploadId: string) {
  return `${getNormalizedServiceBaseUrl()}/chat/uploads/${encodeURIComponent(uploadId)}`
}

function toMessageAttachment(
  id: string,
  filename: string,
  mediaType: string,
  url: string
): PlaygroundRenderableAttachment {
  return {
    id,
    type: "file",
    filename,
    mediaType,
    url,
  }
}

function parseUploadError(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return String(error || "failed to upload attachments")
}

export async function createComposerAttachments(input: FileList | File[]) {
  return Array.from(input).map((file): ComposerAttachment => {
    const id = nextId()
    const mediaType = buildMediaType(file)

    return {
      id,
      file,
      kind: getAttachmentKind(mediaType),
      preview: toMessageAttachment(
        id,
        file.name,
        mediaType,
        URL.createObjectURL(file)
      ),
    }
  })
}

export function releaseComposerAttachment(attachment: ComposerAttachment) {
  URL.revokeObjectURL(attachment.preview.url)
}

export function releaseComposerAttachments(attachments: ComposerAttachment[]) {
  for (const attachment of attachments) {
    releaseComposerAttachment(attachment)
  }
}

export async function uploadComposerAttachments(
  attachments: ComposerAttachment[]
) {
  if (attachments.length === 0) {
    return []
  }

  const formData = new FormData()
  for (const attachment of attachments) {
    formData.append("files", attachment.file, attachment.file.name)
  }

  const response = await fetch(`${getNormalizedServiceBaseUrl()}/chat/uploads`, {
    method: "POST",
    body: formData,
  })

  if (!response.ok) {
    let message = "failed to upload attachments"

    try {
      const body = await response.json()
      message = String(body?.error || message)
    } catch {
      try {
        message = (await response.text()) || message
      } catch {
        // Ignore response parsing failures.
      }
    }

    throw new Error(message)
  }

  const body = await response.json()
  const uploads = Array.isArray(body?.uploads) ? body.uploads : []

  return uploads.map((upload: UploadApiRecord): PlaygroundUploadRef => ({
    uploadId: upload.id,
    filename: upload.filename,
    mediaType: upload.mediaType,
    size: upload.size,
    kind: upload.kind,
    expiresAt: upload.expiresAt,
    url: toUploadUrl(upload.id),
  }))
}

export function buildUserMessageParts(
  text: string,
  uploads: PlaygroundUploadRef[]
) {
  const parts: PlaygroundMessagePart[] = []
  const trimmed = text.trim()

  if (trimmed) {
    parts.push({ type: "text", text: trimmed })
  }

  for (const upload of uploads) {
    parts.push({
      type: "data-upload-ref",
      data: upload,
    })
  }

  return parts
}

export function cloneMessagePart<T extends PlaygroundMessagePart>(part: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(part)
  }

  return JSON.parse(JSON.stringify(part)) as T
}

export function cloneMessageParts(parts: PlaygroundMessagePart[]) {
  return parts.map((part) => cloneMessagePart(part))
}

export function getMessageText(message: PlaygroundUIMessage) {
  return message.parts
    .filter((part): part is Extract<PlaygroundMessagePart, { type: "text" }> =>
      part.type === "text"
    )
    .map((part) => part.text)
    .join("")
}

export function isStreamingMessage(message: PlaygroundUIMessage) {
  return message.parts.some(
    (part) => part.type === "text" && part.state === "streaming"
  )
}

function isUploadRefPart(part: PlaygroundMessagePart): part is UploadRefPart {
  return part.type === "data-upload-ref"
}

export function getMessageAttachments(message: PlaygroundUIMessage) {
  return message.parts.flatMap((part, index): PlaygroundRenderableAttachment[] => {
    const id = `${message.id}:${part.type}:${index}`

    if (part.type === "file") {
      return [
        toMessageAttachment(
          id,
          part.filename || "Attachment",
          part.mediaType,
          part.url
        ),
      ]
    }

    if (isUploadRefPart(part)) {
      return [
        toMessageAttachment(
          id,
          part.data.filename,
          part.data.mediaType,
          part.data.url
        ),
      ]
    }

    return []
  })
}

export function createPlaygroundTransport({
  providerId,
  modelId,
  projectId,
}: {
  providerId: string
  modelId: string
  projectId: string
}) {
  return new DefaultChatTransport<PlaygroundUIMessage>({
    api: `${getNormalizedServiceBaseUrl()}/chat/ui`,
    prepareSendMessagesRequest({ id, messages }) {
      return {
        body: {
          chatId: id,
          messages,
          providerId,
          modelId,
          projectId,
        },
      }
    },
  })
}

export function getErrorMessage(error: unknown) {
  return parseUploadError(error)
}
