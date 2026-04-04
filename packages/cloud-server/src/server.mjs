import { createServer } from "node:http"
import { createCoreServer } from "@otter-prompt/core-server/server"
import {
  pullProjectSnapshot,
  pushProjectSnapshot,
  readProjectStatus,
} from "./storage/cloud-state.mjs"

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

const core = createCoreServer()

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1")
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
    res.writeHead(204)
    res.end()
    return
  }

  if (url.pathname === "/health") {
    return json(res, 200, { ok: true, service: "cloud-server" })
  }

  // Placeholder for better-auth integration. This keeps the surface stable for app integration.
  if (url.pathname === "/auth/session" && req.method === "POST") {
    const body = await readBody(req)
    return json(res, 200, {
      session: {
        user: {
          id: "dev-user",
          name: body.name || "Developer",
          email: body.email || "dev@otter.local",
        },
      },
    })
  }

  if (url.pathname === "/auth/session" && req.method === "GET") {
    return json(res, 200, {
      session: null,
      note: "Integrate better-auth in cloud-server.",
    })
  }

  if (url.pathname === "/sync/push" && req.method === "POST") {
    const body = await readBody(req)
    if (!body.projectId) {
      return json(res, 400, { error: "projectId is required" })
    }
    const project = await pushProjectSnapshot({
      projectId: body.projectId,
      project: body.project,
      files: body.files || [],
    })
    return json(res, 200, {
      projectId: body.projectId,
      revision: project.revision,
      updatedAt: project.updatedAt,
    })
  }

  if (url.pathname === "/sync/pull" && req.method === "POST") {
    const body = await readBody(req)
    if (!body.projectId) {
      return json(res, 400, { error: "projectId is required" })
    }
    const project = await pullProjectSnapshot(body.projectId)
    return json(res, 200, {
      projectId: body.projectId,
      revision: project.revision,
      updatedAt: project.updatedAt,
      files: project.files || [],
    })
  }

  if (url.pathname === "/sync/status" && req.method === "GET") {
    const projectId = url.searchParams.get("projectId")
    if (!projectId) {
      return json(res, 400, { error: "projectId is required" })
    }
    const status = await readProjectStatus(projectId)
    return json(res, 200, { projectId, ...status })
  }

  if (url.pathname.startsWith("/core")) {
    req.url = url.pathname.replace("/core", "") + url.search
    core.emit("request", req, res)
    return
  }

  return json(res, 404, { error: "not found" })
})

const port = Number(process.env.PORT || 9797)
server.listen(port, () => {
  console.log(`[cloud-server] listening on http://127.0.0.1:${port}`)
})
