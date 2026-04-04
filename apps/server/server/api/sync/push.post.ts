import { createError, defineEventHandler, readBody } from "h3"
import {
  buildSnapshot,
  getProject,
  pushProjectSnapshot,
  updateProject,
  updateSyncRecord,
} from "../../lib/services"

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const projectId = body?.projectId
  if (!projectId) {
    throw createError({ statusCode: 400, statusMessage: "projectId is required" })
  }

  const project = await getProject(projectId)
  if (!project) {
    throw createError({ statusCode: 404, statusMessage: "project not found" })
  }

  const files = await buildSnapshot(project.localPath)
  const cloud = await pushProjectSnapshot({
    projectId,
    project: {
      id: project.id,
      name: project.name,
      remoteWorkspaceId: project.remoteWorkspaceId,
    },
    files,
  })

  const fileHashes = Object.fromEntries(files.map((file) => [file.path, file.hash]))
  const now = new Date().toISOString()
  const sync = await updateSyncRecord(projectId, {
    fileHashes,
    lastPushRevision: cloud.revision,
    lastPulledRevision: cloud.revision,
    lastSyncedAt: now,
    conflicts: [],
  })
  const updated = await updateProject(projectId, { lastSyncedAt: now })

  return { sync, project: updated, revision: cloud.revision }
})
