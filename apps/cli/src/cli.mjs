#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { createCoreServer } from "@otter-prompt/core-server/server"

function readPort(argv) {
  const index = argv.findIndex((arg) => arg === "--port")
  if (index === -1) {
    return 8787
  }

  const raw = argv[index + 1]
  const port = Number(raw)
  if (!raw || Number.isNaN(port)) {
    throw new Error("--port requires a number")
  }

  return port
}

async function initProject() {
  const marker = {
    name: "otter-project",
    version: 1,
    createdAt: new Date().toISOString(),
  }

  await mkdir(process.cwd(), { recursive: true })
  await writeFile(
    join(process.cwd(), ".otter-project.json"),
    JSON.stringify(marker, null, 2),
    "utf8",
  )

  console.log("Initialized .otter-project.json")
}

async function main() {
  const [, , command, ...rest] = process.argv

  if (!command || command === "help" || command === "--help") {
    console.log("otter web [--port <number>]")
    console.log("otter init")
    return
  }

  if (command === "init") {
    await initProject()
    return
  }

  if (command === "web") {
    const port = readPort(rest)
    const server = createCoreServer()
    server.listen(port, () => {
      console.log(`[otter] web listening on http://127.0.0.1:${port}`)
    })
    return
  }

  throw new Error(`Unknown command: ${command}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
