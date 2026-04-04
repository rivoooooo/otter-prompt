export async function streamChat({ message, write, apiKey }) {
  const resolvedApiKey = apiKey || process.env.OPENAI_API_KEY

  // If ai-sdk is installed and API key is present, use it. Otherwise fallback to local echo.
  if (resolvedApiKey) {
    try {
      const [{ streamText }, { openai }] = await Promise.all([
        import("ai"),
        import("@ai-sdk/openai"),
      ])

      const result = streamText({
        model: openai(process.env.OTTER_MODEL || "gpt-4.1-mini", {
          apiKey: resolvedApiKey,
        }),
        prompt: message,
      })

      for await (const chunk of result.textStream) {
        write(chunk)
      }
      return
    } catch {
      // Ignore and fallback.
    }
  }

  write(`Echo: ${message}`)
}
