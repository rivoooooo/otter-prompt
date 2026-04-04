import { defineEventHandler, readBody } from "h3"
import { setDesktopKeyRef } from "../../lib/services"

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const desktopKeyRef = await setDesktopKeyRef(body?.ref || null)
  return { desktopKeyRef }
})
