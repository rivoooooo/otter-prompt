import { defineEventHandler } from "h3"
import { listProjects } from "../../lib/services"

export default defineEventHandler(async () => {
  const projects = await listProjects()
  return { projects }
})
