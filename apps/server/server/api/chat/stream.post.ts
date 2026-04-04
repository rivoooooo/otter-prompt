import { defineEventHandler, readBody } from "h3"
import { streamChat } from "../../lib/services"

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const message = body?.message || ""
  const systemPrompt = body?.systemPrompt || ""
  const provider = body?.provider || "openai"
  const model = body?.model || undefined
  const apiKey = event.node.req.headers["x-otter-api-key"]

  event.node.res.statusCode = 200
  event.node.res.setHeader("Content-Type", "text/event-stream")
  event.node.res.setHeader("Cache-Control", "no-cache")
  event.node.res.setHeader("Connection", "keep-alive")

  const write = (chunk: string) => {
    const payload = JSON.stringify({ chunk })
    event.node.res.write(`data: ${payload}\n\n`)
  }

  await streamChat({
    message,
    systemPrompt,
    provider,
    model,
    write,
    apiKey: typeof apiKey === "string" ? apiKey : undefined,
  })

  event.node.res.write("event: done\ndata: {}\n\n")
  event.node.res.end()
})
