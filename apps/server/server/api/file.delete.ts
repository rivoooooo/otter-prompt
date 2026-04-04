import { createError, defineEventHandler, getQuery } from "h3"
import { deletePath } from "../lib/services"

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const path = query.path
  if (typeof path !== "string" || !path) {
    throw createError({ statusCode: 400, statusMessage: "path is required" })
  }

  await deletePath(path)
  return { ok: true }
})
