import { createError, defineEventHandler, readBody } from "h3"
import { openInEditor } from "../../lib/services"

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  if (!body?.path) {
    throw createError({ statusCode: 400, statusMessage: "path is required" })
  }

  await openInEditor(body.path, body.command)
  return { ok: true }
})
