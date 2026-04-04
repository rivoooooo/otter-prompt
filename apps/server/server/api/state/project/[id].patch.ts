import { createError, defineEventHandler, readBody } from "h3"
import { updateProject } from "../../../lib/services"

export default defineEventHandler(async (event) => {
  const patch = await readBody(event)
  const projectId = event.context.params?.id
  if (!projectId) {
    throw createError({ statusCode: 400, statusMessage: "projectId is required" })
  }

  const project = await updateProject(projectId, patch)
  if (!project) {
    throw createError({ statusCode: 404, statusMessage: "project not found" })
  }

  return { project }
})
