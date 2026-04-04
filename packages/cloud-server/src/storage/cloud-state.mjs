import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import { homedir } from "node:os"
import { dirname, join } from "node:path"

const OTTER_HOME = process.env.OTTER_HOME || join(homedir(), ".otter")
const CLOUD_FILE = join(OTTER_HOME, "cloud-state.json")

function defaultCloudState() {
  return {
    projects: {},
  }
}

async function readCloudState() {
  try {
    const raw = await readFile(CLOUD_FILE, "utf8")
    return JSON.parse(raw)
  } catch {
    const state = defaultCloudState()
    await writeCloudState(state)
    return state
  }
}

async function writeCloudState(state) {
  await mkdir(dirname(CLOUD_FILE), { recursive: true })
  const tmp = `${CLOUD_FILE}.${randomUUID()}.tmp`
  await writeFile(tmp, JSON.stringify(state, null, 2), "utf8")
  await rename(tmp, CLOUD_FILE)
}

export async function pushProjectSnapshot({ projectId, project, files }) {
  const state = await readCloudState()
  const previous = state.projects[projectId] || {
    revision: 0,
  }

  const revision = previous.revision + 1
  state.projects[projectId] = {
    project: {
      id: project?.id || projectId,
      name: project?.name || projectId,
      remoteWorkspaceId: project?.remoteWorkspaceId || null,
    },
    files: files || [],
    revision,
    updatedAt: new Date().toISOString(),
  }

  await writeCloudState(state)
  return state.projects[projectId]
}

export async function pullProjectSnapshot(projectId) {
  const state = await readCloudState()
  return (
    state.projects[projectId] || {
      project: null,
      files: [],
      revision: 0,
      updatedAt: null,
    }
  )
}

export async function readProjectStatus(projectId) {
  const project = await pullProjectSnapshot(projectId)
  return {
    revision: project.revision,
    updatedAt: project.updatedAt,
  }
}
