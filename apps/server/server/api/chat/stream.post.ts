import { defineEventHandler, readBody } from "h3"
import {
  resolveProjectSystemPrompt,
  resolveStoredModelRuntimeConfig,
  streamChat,
} from "../../lib/services"

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const message = body?.message || ""
  const providerId = body?.providerId || ""
  const modelId = body?.modelId || ""
  const projectId = body?.projectId || ""

  event.node.res.statusCode = 200
  event.node.res.setHeader("Content-Type", "text/event-stream")
  event.node.res.setHeader("Cache-Control", "no-cache")
  event.node.res.setHeader("Connection", "keep-alive")

  const write = (chunk: string) => {
    const payload = JSON.stringify({ chunk })
    event.node.res.write(`data: ${payload}\n\n`)
  }

  try {
    const [{ apiKey, baseUrl, apiStyle }, systemPrompt] = await Promise.all([
      resolveStoredModelRuntimeConfig({
        providerId,
        modelId,
      }),
      resolveProjectSystemPrompt(projectId),
    ])

    await streamChat({
      message,
      systemPrompt,
      providerId,
      model: modelId,
      baseUrl: baseUrl || undefined,
      apiStyle,
      write,
      apiKey: apiKey || undefined,
    })
  } catch (error) {
    write(
      `Error: ${error instanceof Error ? error.message : "chat stream failed"}`
    )
  }

  event.node.res.write("event: done\ndata: {}\n\n")
  event.node.res.end()
})
