import { defineEventHandler, readBody } from "h3"
import { readState, writeState } from "../../lib/services"

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const state = await readState()
  state.projects = body?.projects || []
  const nextState = await writeState(state)
  return { projects: nextState.projects }
})
