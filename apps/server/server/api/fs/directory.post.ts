import { createError, defineEventHandler, readBody } from "h3"
import { createDirectory } from "../../lib/services"

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  if (!body?.parentPath) {
    throw createError({ statusCode: 400, statusMessage: "parentPath is required" })
  }
  if (!body?.name) {
    throw createError({ statusCode: 400, statusMessage: "name is required" })
  }

  try {
    const path = await createDirectory(body.parentPath, body.name)
    return { path, name: body.name }
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to create directory"
    throw createError({
      statusCode: message.includes("exist") ? 409 : 400,
      statusMessage: message,
    })
  }
})
