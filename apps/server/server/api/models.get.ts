import { defineEventHandler } from "h3"

const DEFAULT_MODELS = ["gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini"]

export default defineEventHandler(() => {
  const envModels = (process.env.OTTER_MODELS || "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean)

  const defaultModel = process.env.OTTER_MODEL || DEFAULT_MODELS[0]
  const models = Array.from(new Set([defaultModel, ...envModels, ...DEFAULT_MODELS]))

  return {
    provider: "openai",
    models,
    defaultModel,
  }
})
