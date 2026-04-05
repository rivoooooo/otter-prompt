import { join } from "node:path"
import { readTextFile } from "../storage/fs-api.mjs"
import { getProject, readState } from "../storage/state-store.mjs"

function buildModelRuntimeConfig(provider, model) {
  return {
    providerId: provider.id,
    modelId: model.id,
    apiKey: provider.apiKey || "",
    baseUrl: provider.baseUrl || "",
    apiStyle: model.apiStyleOverride || provider.apiStyle || "openai",
  }
}

export async function resolveStoredModelRuntimeConfig({ providerId, modelId }) {
  const state = await readState()
  const appSettings = state.preferences?.appSettings
  const providers = appSettings?.providers

  if (!providers || typeof providers !== "object") {
    throw new Error(
      "Provider settings have not been synced to the server yet. Save settings and retry."
    )
  }

  const provider = providers[providerId]
  if (!provider) {
    throw new Error(`Provider "${providerId}" is not configured on the server.`)
  }

  if (!provider.enabled) {
    throw new Error(`Provider "${providerId}" is disabled.`)
  }

  const model = Array.isArray(provider.models)
    ? provider.models.find((candidate) => candidate.id === modelId)
    : null
  if (!model) {
    throw new Error(
      `Model "${modelId}" is not configured under provider "${providerId}".`
    )
  }

  return buildModelRuntimeConfig(provider, model)
}

export async function resolveProjectSystemPrompt(projectId) {
  if (!projectId) {
    return ""
  }

  const project = await getProject(projectId)
  if (!project?.localPath) {
    throw new Error(`Project "${projectId}" was not found.`)
  }

  const mainPath = join(project.localPath, "main.md")

  try {
    return await readTextFile(mainPath)
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return ""
    }

    throw error
  }
}
