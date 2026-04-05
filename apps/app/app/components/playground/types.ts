import type { DefaultChatTransport, FileUIPart, UIMessage } from "ai"

export type PlaygroundUploadKind = "image" | "text" | "binary"

export type PlaygroundUploadRef = {
  uploadId: string
  filename: string
  mediaType: string
  size: number
  kind: PlaygroundUploadKind
  url: string
  expiresAt: string
}

export type PlaygroundDataParts = {
  "upload-ref": PlaygroundUploadRef
}

export type PlaygroundUIMessage = UIMessage<unknown, PlaygroundDataParts>
export type PlaygroundMessagePart = PlaygroundUIMessage["parts"][number]
export type PlaygroundFilePart = FileUIPart
export type PlaygroundRenderableAttachment = FileUIPart & { id: string }
export type PlaygroundChatTransport = DefaultChatTransport<PlaygroundUIMessage>
