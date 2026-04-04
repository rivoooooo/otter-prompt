import { createError, defineEventHandler, readBody } from "h3"
import { createProject } from "../../lib/services"

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  if (!body?.localPath) {
    throw createError({ statusCode: 400, statusMessage: "localPath is required" })
  }

  const project = await createProject(body)
  return { project }
})
