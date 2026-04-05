import { defineEventHandler, readBody } from "h3"
import { readState, writeState } from "../../lib/services"

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const state = await readState()
  state.preferences = {
    ...(state.preferences || {}),
    appSettings: body?.settings || null,
  }
  const nextState = await writeState(state)
  return { settings: nextState.preferences?.appSettings || null }
})
