import { createError, defineEventHandler, readBody } from "h3"
import {
  applySnapshot,
  getProject,
  getSyncRecord,
  pullProjectSnapshot,
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

  const syncRecord = await getSyncRecord(projectId)
  const cloud = await pullProjectSnapshot(projectId)
  const { nextHashes, conflicts } = await applySnapshot({
    projectPath: project.localPath,
    incomingFiles: cloud.files || [],
    previousHashes: syncRecord.fileHashes || {},
  })

  const now = new Date().toISOString()
  const sync = await updateSyncRecord(projectId, {
    fileHashes: nextHashes,
    conflicts,
    lastPulledRevision: cloud.revision,
    lastSyncedAt: now,
  })
  const updated = await updateProject(projectId, { lastSyncedAt: now })

  return { sync, project: updated, conflicts, revision: cloud.revision }
})
