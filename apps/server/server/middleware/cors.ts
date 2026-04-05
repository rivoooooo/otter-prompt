import { defineEventHandler, setHeader } from "h3"

export default defineEventHandler((event) => {
  setHeader(event, "Access-Control-Allow-Origin", "*")
  setHeader(event, "Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,PATCH,OPTIONS")
  setHeader(event, "Access-Control-Allow-Headers", "Content-Type, Authorization")

  if (event.method === "OPTIONS") {
    event.node.res.statusCode = 204
    event.node.res.end()
  }
})
