import { defineEventHandler } from "h3"
import { readState } from "../../lib/services"

export default defineEventHandler(async () => {
  const state = await readState()
  return { state }
})
