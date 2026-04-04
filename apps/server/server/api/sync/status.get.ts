import { createError, defineEventHandler, getQuery } from "h3"
import { getSyncRecord, readProjectStatus } from "../../lib/services"

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const projectId = query.projectId
  if (typeof projectId !== "string" || !projectId) {
    throw createError({ statusCode: 400, statusMessage: "projectId is required" })
  }

  const [local, cloud] = await Promise.all([
    getSyncRecord(projectId),
    readProjectStatus(projectId),
  ])

  return { local, cloud }
})
