import { createServer } from "node:http"
import { readFile } from "node:fs/promises"
import { execFile } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join, normalize } from "node:path"
import { URL } from "node:url"
import { promisify } from "node:util"
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
  createDirectory,
  deletePath,
  listDirectoryChildren,
  listDirectoryRoots,
  listTree,
  readTextFile,
  renamePath,
  writeTextFile,
} from "./storage/fs-api.mjs"
import {
  resolveProjectSystemPrompt,
  resolveStoredModelRuntimeConfig,
} from "./ai/chat-runtime.mjs"
import { streamChat } from "./ai/ai-client.mjs"
import { openInEditor } from "./editor.mjs"
import { applySnapshot, buildSnapshot } from "./storage/project-snapshot.mjs"
import {
  getCloudSyncStatus,
  pullFromCloud,
  pushToCloud,
} from "./sync-client.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_APP_DIST = normalize(
  join(__dirname, "../../../apps/app/build/client")
)
const execFileAsync = promisify(execFile)

const CONTENT_TYPE = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
}

function getExtname(pathname) {
  const index = pathname.lastIndexOf(".")
  return index >= 0 ? pathname.slice(index).toLowerCase() : ""
}

async function tryServeAppAsset(req, res, pathname) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return false
  }

  const appDist = process.env.OTTER_APP_DIST || DEFAULT_APP_DIST
  const normalized = pathname === "/" ? "/index.html" : pathname
  const safePath = normalize(normalized).replace(/^(\.\.[/\\])+/, "")
  const candidate = join(appDist, safePath)

  try {
    const raw = await readFile(candidate)
    const ext = getExtname(safePath)
    res.writeHead(200, {
      "Content-Type": CONTENT_TYPE[ext] || "application/octet-stream",
      "Cache-Control": "no-cache",
    })
    res.end(req.method === "HEAD" ? undefined : raw)
    return true
  } catch {
    // Continue to fallback
  }

  // SPA fallback for route-like paths.
  if (!safePath.includes(".") || safePath.endsWith(".html")) {
    try {
      const indexHtml = await readFile(join(appDist, "index.html"))
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache",
      })
      res.end(req.method === "HEAD" ? undefined : indexHtml)
      return true
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
      res.end(
        "Front-end not found. Build app first: pnpm --filter @otter-prompt/app build"
      )
      return true
    }
  }

  return false
}

function json(res, status, body) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  )
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

async function selectDirectory() {
  const platform = process.platform

  if (platform === "darwin") {
    const script =
      'POSIX path of (choose folder with prompt "Select project folder")'
    const { stdout } = await execFileAsync("osascript", ["-e", script])
    return stdout.trim()
  }

  if (platform === "win32") {
    const command = [
      "Add-Type -AssemblyName System.Windows.Forms",
      "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
      '$dialog.Description = "Select project folder"',
      "$dialog.ShowNewFolderButton = $false",
      "$result = $dialog.ShowDialog()",
      "if ($result -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dialog.SelectedPath }",
    ].join("; ")

    const { stdout } = await execFileAsync("powershell", [
      "-NoProfile",
      "-Command",
      command,
    ])

    return stdout.trim()
  }

  const { stdout } = await execFileAsync("zenity", [
    "--file-selection",
    "--directory",
    "--title=Select project folder",
  ])

  return stdout.trim()
}

export function createCoreServer() {
  return createServer(async (req, res) => {
    const method = req.method || "GET"
    const url = new URL(req.url || "/", "http://127.0.0.1")

    try {
      if (method === "OPTIONS") {
        res.setHeader("Access-Control-Allow-Origin", "*")
        res.setHeader(
          "Access-Control-Allow-Methods",
          "GET,POST,PUT,DELETE,OPTIONS"
        )
        res.setHeader(
          "Access-Control-Allow-Headers",
          "Content-Type, Authorization"
        )
        res.writeHead(204)
        res.end()
        return
      }

      if (method === "GET" && url.pathname === "/health") {
        return json(res, 200, { ok: true })
      }

      if (method === "GET" && url.pathname === "/models") {
        const defaultModel = process.env.OTTER_MODEL || "gpt-4.1-mini"
        const envModels = (process.env.OTTER_MODELS || "")
          .split(",")
          .map((model) => model.trim())
          .filter(Boolean)
        const models = Array.from(
          new Set([defaultModel, ...envModels, "gpt-4.1", "gpt-4o-mini"])
        )

        return json(res, 200, {
          provider: "openai",
          defaultModel,
          models,
        })
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

      if (method === "PUT" && url.pathname === "/state/settings") {
        const body = await readBody(req)
        const state = await readState()
        state.preferences = {
          ...(state.preferences || {}),
          appSettings: body.settings || null,
        }
        const nextState = await writeState(state)
        return json(res, 200, {
          settings: nextState.preferences?.appSettings || null,
        })
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

      if (method === "POST" && url.pathname === "/dialog/directory") {
        const path = await selectDirectory()
        if (!path) {
          return json(res, 400, { error: "No directory selected" })
        }

        return json(res, 200, { path })
      }

      if (method === "GET" && url.pathname === "/dialog/directories/roots") {
        const projects = await listProjects()
        const roots = await listDirectoryRoots(projects)
        return json(res, 200, { roots })
      }

      if (method === "GET" && url.pathname === "/dialog/directories/children") {
        const path = url.searchParams.get("path")
        if (!path) {
          return json(res, 400, { error: "path is required" })
        }

        const showHidden =
          url.searchParams.get("showHidden") === "1" ||
          url.searchParams.get("showHidden") === "true"
        const children = await listDirectoryChildren(path, { showHidden })
        return json(res, 200, { path, children })
      }

      if (method === "POST" && url.pathname === "/fs/directory") {
        const body = await readBody(req)
        if (!body?.parentPath) {
          return json(res, 400, { error: "parentPath is required" })
        }
        if (!body?.name) {
          return json(res, 400, { error: "name is required" })
        }

        try {
          const path = await createDirectory(body.parentPath, body.name)
          return json(res, 201, { path, name: body.name })
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "failed to create directory"
          const status = message.includes("exist") ? 409 : 400
          return json(res, status, { error: message })
        }
      }

      if (method === "POST" && url.pathname === "/fs/rename") {
        const body = await readBody(req)
        if (!body?.fromPath) {
          return json(res, 400, { error: "fromPath is required" })
        }
        if (!body?.toPath) {
          return json(res, 400, { error: "toPath is required" })
        }

        try {
          const path = await renamePath(body.fromPath, body.toPath)
          return json(res, 200, { path })
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "failed to rename path"
          const status = message.includes("exist") ? 409 : 400
          return json(res, status, { error: message })
        }
      }

      if (method === "POST" && url.pathname === "/chat/stream") {
        const body = await readBody(req)
        const message = body.message || ""
        const providerId = body.providerId || ""
        const modelId = body.modelId || ""
        const projectId = body.projectId || ""

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

        try {
          const [{ apiKey, baseUrl, apiStyle }, systemPrompt] =
            await Promise.all([
              resolveStoredModelRuntimeConfig({
                providerId,
                modelId,
              }),
              resolveProjectSystemPrompt(projectId),
            ])

          await streamChat({
            message,
            systemPrompt,
            providerId,
            model: modelId,
            baseUrl: baseUrl || undefined,
            apiStyle,
            write,
            apiKey: apiKey || undefined,
          })
        } catch (error) {
          write(
            `Error: ${error instanceof Error ? error.message : "chat stream failed"}`
          )
        }
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

        const fileHashes = Object.fromEntries(
          files.map((file) => [file.path, file.hash])
        )
        const now = new Date().toISOString()
        const sync = await updateSyncRecord(projectId, {
          fileHashes,
          lastPushRevision: cloud.revision,
          lastPulledRevision: cloud.revision,
          lastSyncedAt: now,
          conflicts: [],
        })
        const updated = await updateProject(projectId, { lastSyncedAt: now })

        return json(res, 200, {
          sync,
          project: updated,
          revision: cloud.revision,
        })
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

      if (await tryServeAppAsset(req, res, url.pathname)) {
        return
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
