import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { createHash, randomUUID } from "node:crypto"
import { homedir } from "node:os"
import { dirname, join } from "node:path"

const OTTER_HOME = process.env.OTTER_HOME || join(homedir(), ".otter")
const STATE_FILE = join(OTTER_HOME, "state.json")
const LEGACY_PROJECTS_FILE = join(OTTER_HOME, "projects.json")

function defaultState() {
  return {
    version: 1,
    desktopKeyRef: null,
    preferences: {},
    projects: [],
    sync: {},
  }
}

async function readJSON(path) {
  const raw = await readFile(path, "utf8")
  return JSON.parse(raw)
}

async function writeStateAtomic(state) {
  await mkdir(dirname(STATE_FILE), { recursive: true })
  const tmp = `${STATE_FILE}.${randomUUID()}.tmp`
  await writeFile(tmp, JSON.stringify(state, null, 2), "utf8")
  await rename(tmp, STATE_FILE)
}

function withDefaults(input) {
  const base = defaultState()
  return {
    ...base,
    ...input,
    projects: input?.projects || [],
    sync: input?.sync || {},
    preferences: input?.preferences || {},
    desktopKeyRef: input?.desktopKeyRef || null,
  }
}

export function sha256(content) {
  return createHash("sha256").update(content).digest("hex")
}

async function migrateLegacyProjects() {
  try {
    const legacy = await readJSON(LEGACY_PROJECTS_FILE)
    const migrated = withDefaults()
    migrated.projects = (legacy.projects || []).map((project) => ({
      id: project.id || randomUUID(),
      name: project.name || "Untitled Project",
      localPath: project.localPath,
      gitEnabled: Boolean(project.gitEnabled),
      createdAt: project.createdAt || new Date().toISOString(),
      updatedAt: project.updatedAt || new Date().toISOString(),
      remoteWorkspaceId: project.remoteWorkspaceId || null,
      lastSyncedAt: null,
    }))
    await writeStateAtomic(migrated)
    return migrated
  } catch {
    return null
  }
}

export async function readState() {
  try {
    const data = await readJSON(STATE_FILE)
    return withDefaults(data)
  } catch {
    const migrated = await migrateLegacyProjects()
    if (migrated) {
      return migrated
    }
    const data = withDefaults()
    await writeStateAtomic(data)
    return data
  }
}

export async function writeState(nextState) {
  const state = withDefaults(nextState)
  await writeStateAtomic(state)
  return state
}

export async function listProjects() {
  const state = await readState()
  return state.projects
}

export async function createProject(input) {
  const state = await readState()
  const now = new Date().toISOString()
  const project = {
    id: randomUUID(),
    name: input.name || "Untitled Project",
    localPath: input.localPath,
    gitEnabled: Boolean(input.gitEnabled),
    createdAt: now,
    updatedAt: now,
    remoteWorkspaceId: input.remoteWorkspaceId || null,
    lastSyncedAt: null,
  }

  state.projects = [project, ...state.projects]
  await writeState(state)
  return project
}

export async function updateProject(projectId, patch) {
  const state = await readState()
  const index = state.projects.findIndex((project) => project.id === projectId)
  if (index === -1) {
    return null
  }

  const current = state.projects[index]
  state.projects[index] = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  }
  await writeState(state)
  return state.projects[index]
}

export async function getProject(projectId) {
  const state = await readState()
  return state.projects.find((project) => project.id === projectId) || null
}

export async function updateSyncRecord(projectId, patch) {
  const state = await readState()
  state.sync[projectId] = {
    projectId,
    fileHashes: {},
    conflicts: [],
    ...state.sync[projectId],
    ...patch,
  }
  await writeState(state)
  return state.sync[projectId]
}

export async function getSyncRecord(projectId) {
  const state = await readState()
  return (
    state.sync[projectId] || {
      projectId,
      fileHashes: {},
      conflicts: [],
      lastSyncedAt: null,
      lastPulledRevision: 0,
      lastPushRevision: 0,
    }
  )
}

export async function setDesktopKeyRef(ref) {
  const state = await readState()
  state.desktopKeyRef = ref
  await writeState(state)
  return state.desktopKeyRef
}
