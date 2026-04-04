import { defineEventHandler } from "h3"
import { listDirectoryRoots, listProjects } from "../../../lib/services"

export default defineEventHandler(async () => {
  const projects = await listProjects()
  const roots = await listDirectoryRoots(projects)
  return { roots }
})
