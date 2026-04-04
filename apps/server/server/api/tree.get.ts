import { createError, defineEventHandler, getQuery } from "h3"
import { listTree } from "../lib/services"

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const projectPath = query.projectPath
  if (typeof projectPath !== "string" || !projectPath) {
    throw createError({ statusCode: 400, statusMessage: "projectPath is required" })
  }

  const tree = await listTree(projectPath)
  return { tree }
})
