import { createError, defineEventHandler, getQuery } from "h3"
import { listDirectoryChildren } from "../../../lib/services"

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const path = query.path

  if (typeof path !== "string" || !path) {
    throw createError({ statusCode: 400, statusMessage: "path is required" })
  }

  const showHidden = query.showHidden === "1" || query.showHidden === "true"
  const children = await listDirectoryChildren(path, { showHidden })

  return { path, children }
})
