import { convertToModelMessages, streamText } from "ai"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createOpenAI } from "@ai-sdk/openai"
import {
  getChatUploadRecord,
  readChatUploadDataUrl,
  readChatUploadText,
} from "./chat-upload-store.mjs"

function normalizeBaseUrl(baseUrl, fallback = "") {
  const value = String(baseUrl || fallback || "").trim()
  return value.replace(/\/+$/, "")
}

function withTrailingPeriod(message) {
  return /[.!?]$/.test(message) ? message : `${message}.`
}

function getStatusCode(error) {
  const candidates = [
    error?.statusCode,
    error?.status,
    error?.response?.status,
    error?.cause?.statusCode,
    error?.cause?.status,
  ]

  for (const candidate of candidates) {
    const statusCode = Number(candidate)
    if (Number.isFinite(statusCode) && statusCode > 0) {
      return statusCode
    }
  }

  return null
}

function tryParseJson(input) {
  if (typeof input !== "string") {
    return null
  }

  try {
    return JSON.parse(input)
  } catch {
    return null
  }
}

function extractErrorMessage(value) {
  if (!value) {
    return ""
  }

  if (typeof value === "string") {
    const parsed = tryParseJson(value)
    if (parsed) {
      return extractErrorMessage(parsed)
    }

    return value.trim()
  }

  if (value instanceof Error) {
    return extractErrorMessage({
      message: value.message,
      cause: value.cause,
      responseBody: value.responseBody,
    })
  }

  if (typeof value === "object") {
    const candidates = [
      value.error?.message,
      value.message,
      value.detail,
      value.title,
      value.cause,
      value.responseBody,
      value.body,
    ]

    for (const candidate of candidates) {
      const message = extractErrorMessage(candidate)
      if (message) {
        return message
      }
    }
  }

  return ""
}

function cleanSdkErrorMessage(message) {
  return String(message || "")
    .replace(/^[A-Za-z]+Error \[[^\]]+\]:\s*/g, "")
    .replace(/^[A-Za-z]+Error:\s*/g, "")
    .trim()
}

function getErrorHint(apiStyle, statusCode) {
  if (statusCode === 401) {
    return "Check the API key configured for this provider."
  }

  if (statusCode === 403) {
    return "Check the API key permissions and account access for this provider."
  }

  if (statusCode === 404) {
    return apiStyle === "anthropic"
      ? "Check the base URL and model name for this Anthropic-style provider."
      : "Check the base URL and model name for this OpenAI-style provider."
  }

  if (statusCode === 429) {
    return "The provider rate-limited this request. Retry later or switch models."
  }

  if (statusCode && statusCode >= 500) {
    return "The provider returned a server error. Retry later."
  }

  return ""
}

function normalizeProviderError(apiStyle, error) {
  const fallback =
    apiStyle === "anthropic"
      ? "Anthropic-style request failed"
      : "OpenAI-style request failed"
  const statusCode = getStatusCode(error)
  const rawMessage = cleanSdkErrorMessage(extractErrorMessage(error))
  const message = rawMessage || fallback
  const hint = getErrorHint(apiStyle, statusCode)

  if (!hint) {
    return message
  }

  if (message.toLowerCase().includes(hint.toLowerCase())) {
    return message
  }

  return `${withTrailingPeriod(message)} ${hint}`
}

function buildHttpError(message, statusCode, responseBody) {
  const error = new Error(message)
  error.statusCode = statusCode
  error.responseBody = responseBody
  return error
}

function getOpenAIBaseUrl(baseUrl) {
  const normalized = normalizeBaseUrl(
    baseUrl,
    process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"
  )

  if (!normalized) {
    return "https://api.openai.com/v1"
  }

  return normalized.endsWith("/v1") ? normalized : `${normalized}/v1`
}

function getAnthropicBaseUrl(baseUrl) {
  const normalized = normalizeBaseUrl(
    baseUrl,
    process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com/v1"
  )

  if (!normalized) {
    return "https://api.anthropic.com/v1"
  }

  return normalized.endsWith("/v1") ? normalized : `${normalized}/v1`
}

function getRequiredApiKey(apiStyle, apiKey) {
  const envKey =
    apiStyle === "anthropic"
      ? process.env.ANTHROPIC_API_KEY
      : process.env.OPENAI_API_KEY
  const resolvedApiKey = String(apiKey || envKey || "").trim()

  if (!resolvedApiKey) {
    throw new Error(
      apiStyle === "anthropic"
        ? "Missing API key for Anthropic-style provider"
        : "Missing API key for OpenAI-style provider"
    )
  }

  return resolvedApiKey
}

function resolveApiStyle(provider, apiStyle) {
  return apiStyle === "anthropic" ||
    String(provider || "")
      .trim()
      .toLowerCase() === "anthropic"
    ? "anthropic"
    : "openai"
}

function getResolvedModelId(model, apiStyle) {
  const fallbackModel =
    apiStyle === "anthropic"
      ? process.env.OTTER_ANTHROPIC_MODEL || ""
      : process.env.OTTER_MODEL || ""
  const resolvedModel = String(model || fallbackModel).trim()

  if (!resolvedModel) {
    throw new Error(
      apiStyle === "anthropic"
        ? "Missing model for Anthropic-style provider"
        : "Missing model for OpenAI-style provider"
    )
  }

  return resolvedModel
}

function createLanguageModel({
  provider,
  model,
  apiKey,
  baseUrl,
  apiStyle,
}) {
  const resolvedApiStyle = resolveApiStyle(provider, apiStyle)
  const resolvedModel = getResolvedModelId(model, resolvedApiStyle)
  const resolvedApiKey = getRequiredApiKey(resolvedApiStyle, apiKey)

  if (resolvedApiStyle === "anthropic") {
    const anthropic = createAnthropic({
      apiKey: resolvedApiKey,
      baseURL: getAnthropicBaseUrl(baseUrl),
    })

    return anthropic(resolvedModel)
  }

  const openai = createOpenAI({
    apiKey: resolvedApiKey,
    baseURL: getOpenAIBaseUrl(baseUrl),
  })

  return openai(resolvedModel)
}

function convertPlaygroundDataPart(part) {
  if (part.type === "data-text-file") {
    const filename = part.data?.filename || "attachment.txt"
    const mediaType = part.data?.mediaType || "text/plain"
    const text = String(part.data?.text || "")

    return {
      type: "text",
      text: `Attached text file "${filename}" (${mediaType}):\n\n${text}`,
    }
  }

  if (part.type === "data-uploaded-file") {
    const filename = part.data?.filename || "attachment"
    const mediaType = part.data?.mediaType || "application/octet-stream"
    const size = Number(part.data?.size || 0)

    return {
      type: "text",
      text: `Attached file metadata:\n- filename: ${filename}\n- media type: ${mediaType}\n- size: ${size} bytes\n- note: binary content is attached in the UI but not inlined into the model request`,
    }
  }

  return undefined
}

async function hydrateUploadRefPart(part) {
  const uploadId = String(part.data?.uploadId || "").trim()
  if (!uploadId) {
    return undefined
  }

  const record = await getChatUploadRecord(uploadId)
  if (!record) {
    const filename = part.data?.filename || "attachment"
    throw new Error(`Attachment "${filename}" is unavailable or expired.`)
  }

  if (record.kind === "image") {
    const payload = await readChatUploadDataUrl(uploadId)
    if (!payload) {
      throw new Error(`Attachment "${record.filename}" is unavailable.`)
    }

    return {
      type: "file",
      filename: record.filename,
      mediaType: record.mediaType,
      url: payload.dataUrl,
    }
  }

  if (record.kind === "text") {
    const payload = await readChatUploadText(uploadId)
    if (!payload) {
      throw new Error(`Attachment "${record.filename}" is unavailable.`)
    }

    return {
      type: "data-text-file",
      data: {
        filename: record.filename,
        mediaType: record.mediaType,
        size: record.size,
        text: payload.text,
      },
    }
  }

  return {
    type: "data-uploaded-file",
    data: {
      filename: record.filename,
      mediaType: record.mediaType,
      size: record.size,
    },
  }
}

async function hydratePlaygroundMessages(messages) {
  return Promise.all(
    messages.map(async (message) => {
      if (!message || typeof message !== "object" || !Array.isArray(message.parts)) {
        return message
      }

      const parts = (
        await Promise.all(
          message.parts.map(async (part) => {
            if (part?.type === "data-upload-ref") {
              return hydrateUploadRefPart(part)
            }

            return part
          })
        )
      ).filter(Boolean)

      return {
        ...message,
        parts,
      }
    })
  )
}

async function streamOpenAIStyleChat({
  message,
  systemPrompt,
  model,
  apiKey,
  baseUrl,
  write,
}) {
  const resolvedModel = String(model || process.env.OTTER_MODEL || "").trim()
  if (!resolvedModel) {
    throw new Error("Missing model for OpenAI-style provider")
  }

  try {
    const resolvedApiKey = getRequiredApiKey("openai", apiKey)
    const response = await fetch(`${getOpenAIBaseUrl(baseUrl)}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${resolvedApiKey}`,
      },
      body: JSON.stringify({
        model: resolvedModel,
        stream: true,
        messages: [
          ...(systemPrompt
            ? [
                {
                  role: "system",
                  content: systemPrompt,
                },
              ]
            : []),
          {
            role: "user",
            content: message,
          },
        ],
      }),
    })

    if (!response.ok) {
      const reason = await response.text()
      throw buildHttpError(
        reason || "OpenAI-style request failed",
        response.status,
        reason
      )
    }

    if (!response.body) {
      throw new Error("OpenAI-style response stream is unavailable")
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
      const { value, done } = await reader.read()
      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const events = buffer.split("\n\n")
      buffer = events.pop() || ""

      for (const event of events) {
        const payload = getSsePayload(event)
        if (!payload || payload === "[DONE]") {
          continue
        }

        let data
        try {
          data = JSON.parse(payload)
        } catch {
          continue
        }

        if (Array.isArray(data?.choices)) {
          for (const choice of data.choices) {
            const delta = choice?.delta

            if (typeof delta?.content === "string" && delta.content) {
              write(delta.content)
              continue
            }

            if (Array.isArray(delta?.content)) {
              for (const part of delta.content) {
                if (typeof part?.text === "string" && part.text) {
                  write(part.text)
                }
              }
            }
          }
        }

        if (data?.error) {
          throw buildHttpError(
            data.error?.message || "OpenAI-style request failed",
            data.error?.status || null,
            data
          )
        }
      }
    }
  } catch (error) {
    throw new Error(normalizeProviderError("openai", error))
  }
}

function getSsePayload(block) {
  const lines = block.split("\n")
  const dataLines = []

  for (const line of lines) {
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim())
    }
  }

  return dataLines.join("\n")
}

async function streamAnthropicStyleChat({
  message,
  systemPrompt,
  model,
  apiKey,
  baseUrl,
  write,
}) {
  const resolvedModel = String(model || "").trim()
  if (!resolvedModel) {
    throw new Error("Missing model for Anthropic-style provider")
  }

  try {
    const resolvedApiKey = getRequiredApiKey("anthropic", apiKey)
    const response = await fetch(`${getAnthropicBaseUrl(baseUrl)}/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": resolvedApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: resolvedModel,
        system: systemPrompt || undefined,
        max_tokens: 4096,
        stream: true,
        messages: [
          {
            role: "user",
            content: message,
          },
        ],
      }),
    })

    if (!response.ok) {
      const reason = await response.text()
      throw buildHttpError(
        reason || "Anthropic-style request failed",
        response.status,
        reason
      )
    }

    if (!response.body) {
      throw new Error("Anthropic-style response stream is unavailable")
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
      const { value, done } = await reader.read()
      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const events = buffer.split("\n\n")
      buffer = events.pop() || ""

      for (const event of events) {
        const payload = getSsePayload(event)
        if (!payload || payload === "[DONE]") {
          continue
        }

        let data
        try {
          data = JSON.parse(payload)
        } catch {
          continue
        }

        if (
          data?.type === "content_block_delta" &&
          data.delta?.type === "text_delta" &&
          typeof data.delta.text === "string"
        ) {
          write(data.delta.text)
        }

        if (data?.type === "error") {
          throw buildHttpError(
            data.error?.message || "Anthropic-style request failed",
            data.error?.status || null,
            data
          )
        }
      }
    }
  } catch (error) {
    throw new Error(normalizeProviderError("anthropic", error))
  }
}

export async function streamChat({
  message,
  systemPrompt,
  provider,
  providerId,
  model,
  write,
  apiKey,
  baseUrl,
  apiStyle,
}) {
  const resolvedApiStyle = resolveApiStyle(provider, apiStyle)

  if (resolvedApiStyle === "anthropic") {
    return streamAnthropicStyleChat({
      message,
      systemPrompt,
      model,
      apiKey,
      baseUrl,
      write,
    })
  }

  return streamOpenAIStyleChat({
    message,
    systemPrompt,
    model,
    apiKey,
    baseUrl,
    write,
  })
}

export async function streamChatUI({
  messages,
  systemPrompt,
  provider,
  model,
  response,
  apiKey,
  baseUrl,
  apiStyle,
}) {
  const resolvedApiStyle = resolveApiStyle(provider, apiStyle)

  try {
    const hydratedMessages = await hydratePlaygroundMessages(messages)
    const result = streamText({
      model: createLanguageModel({
        provider,
        model,
        apiKey,
        baseUrl,
        apiStyle: resolvedApiStyle,
      }),
      system: systemPrompt || undefined,
      messages: await convertToModelMessages(hydratedMessages, {
        convertDataPart: convertPlaygroundDataPart,
      }),
    })

    result.pipeUIMessageStreamToResponse(response, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    })
  } catch (error) {
    throw new Error(normalizeProviderError(resolvedApiStyle, error))
  }
}
