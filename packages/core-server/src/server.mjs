import { createServer } from "node:http"
import { URL } from "node:url"
import {
  createProject,
  getProject,
  getSyncRecord,
  listProjects,
  readState,
  setDesktopKeyRef,
  updateProject,
  updateSyncRecord,
  writeState,
} from "./storage/state-store.mjs"
import {
  deletePath,
  listTree,
  readTextFile,
  writeTextFile,
} from "./storage/local-fs.mjs"
import { streamChat } from "./ai/ai-client.mjs"
import { openInEditor } from "./editor.mjs"
import { applySnapshot, buildSnapshot } from "./storage/project-snapshot.mjs"
import { getCloudSyncStatus, pullFromCloud, pushToCloud } from "./sync-client.mjs"

function json(res, status, body) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
  res.writeHead(status, { "Content-Type": "application/json" })
  res.end(JSON.stringify(body))
}

async function readBody(req) {
  let raw = ""
  for await (const chunk of req) {
    raw += chunk
  }

  if (!raw) {
    return {}
  }

  return JSON.parse(raw)
}

export function createCoreServer() {
  return createServer(async (req, res) => {
    const method = req.method || "GET"
    const url = new URL(req.url || "/", "http://127.0.0.1")

    try {
      if (method === "OPTIONS") {
        res.setHeader("Access-Control-Allow-Origin", "*")
        res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
        res.writeHead(204)
        res.end()
        return
      }

      if (method === "GET" && url.pathname === "/health") {
        return json(res, 200, { ok: true })
      }

      if (method === "GET" && url.pathname === "/projects") {
        const projects = await listProjects()
        return json(res, 200, { projects })
      }

      if (method === "POST" && url.pathname === "/projects") {
        const body = await readBody(req)
        if (!body.localPath) {
          return json(res, 400, { error: "localPath is required" })
        }

        const project = await createProject(body)
        return json(res, 201, { project })
      }

      if (method === "GET" && url.pathname === "/state") {
        const state = await readState()
        return json(res, 200, { state })
      }

      if (method === "PUT" && url.pathname === "/state/projects") {
        const body = await readBody(req)
        const state = await readState()
        state.projects = body.projects || []
        const nextState = await writeState(state)
        return json(res, 200, { projects: nextState.projects })
      }

      if (method === "PATCH" && url.pathname.startsWith("/state/project/")) {
        const projectId = url.pathname.slice("/state/project/".length)
        const patch = await readBody(req)
        const project = await updateProject(projectId, patch)
        if (!project) {
          return json(res, 404, { error: "project not found" })
        }
        return json(res, 200, { project })
      }

      if (method === "PUT" && url.pathname === "/state/desktop-key-ref") {
        const body = await readBody(req)
        const desktopKeyRef = await setDesktopKeyRef(body.ref || null)
        return json(res, 200, { desktopKeyRef })
      }

      if (method === "GET" && url.pathname === "/tree") {
        const projectPath = url.searchParams.get("projectPath")
        if (!projectPath) {
          return json(res, 400, { error: "projectPath is required" })
        }

        const tree = await listTree(projectPath)
        return json(res, 200, { tree })
      }

      if (method === "GET" && url.pathname === "/file") {
        const path = url.searchParams.get("path")
        if (!path) {
          return json(res, 400, { error: "path is required" })
        }

        const content = await readTextFile(path)
        return json(res, 200, { content })
      }

      if (method === "PUT" && url.pathname === "/file") {
        const body = await readBody(req)
        if (!body.path) {
          return json(res, 400, { error: "path is required" })
        }

        await writeTextFile(body.path, body.content || "")
        return json(res, 200, { ok: true })
      }

      if (method === "DELETE" && url.pathname === "/file") {
        const path = url.searchParams.get("path")
        if (!path) {
          return json(res, 400, { error: "path is required" })
        }

        await deletePath(path)
        return json(res, 200, { ok: true })
      }

      if (method === "POST" && url.pathname === "/editor/open") {
        const body = await readBody(req)
        if (!body.path) {
          return json(res, 400, { error: "path is required" })
        }

        await openInEditor(body.path, body.command)
        return json(res, 200, { ok: true })
      }

      if (method === "POST" && url.pathname === "/chat/stream") {
        const body = await readBody(req)
        const message = body.message || ""
        const apiKey = req.headers["x-otter-api-key"]

        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          Connection: "keep-alive",
          "Cache-Control": "no-cache",
          "Access-Control-Allow-Origin": "*",
        })

        const write = (chunk) => {
          const payload = JSON.stringify({ chunk })
          res.write(`data: ${payload}\n\n`)
        }

        await streamChat({
          message,
          write,
          apiKey: typeof apiKey === "string" ? apiKey : undefined,
        })
        res.write("event: done\\ndata: {}\\n\\n")
        res.end()
        return
      }

      if (method === "POST" && url.pathname === "/sync/push") {
        const body = await readBody(req)
        const projectId = body.projectId
        const project = await getProject(projectId)
        if (!project) {
          return json(res, 404, { error: "project not found" })
        }

        const files = await buildSnapshot(project.localPath)
        const cloud = await pushToCloud({
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

        return json(res, 200, { sync, project: updated, revision: cloud.revision })
      }

      if (method === "POST" && url.pathname === "/sync/pull") {
        const body = await readBody(req)
        const projectId = body.projectId
        const project = await getProject(projectId)
        if (!project) {
          return json(res, 404, { error: "project not found" })
        }

        const syncRecord = await getSyncRecord(projectId)
        const cloud = await pullFromCloud({
          projectId,
          sinceRevision: syncRecord.lastPulledRevision || 0,
        })
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
        return json(res, 200, {
          sync,
          project: updated,
          conflicts,
          revision: cloud.revision,
        })
      }

      if (method === "GET" && url.pathname === "/sync/status") {
        const projectId = url.searchParams.get("projectId")
        if (!projectId) {
          return json(res, 400, { error: "projectId is required" })
        }

        const [local, cloud] = await Promise.all([
          getSyncRecord(projectId),
          getCloudSyncStatus(projectId),
        ])
        return json(res, 200, { local, cloud })
      }

      json(res, 404, { error: "not found" })
    } catch (error) {
      json(res, 500, {
        error: error instanceof Error ? error.message : "unknown error",
      })
    }
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT || 8787)
  const server = createCoreServer()
  server.listen(port, () => {
    console.log(`[core-server] listening on http://127.0.0.1:${port}`)
  })
}
