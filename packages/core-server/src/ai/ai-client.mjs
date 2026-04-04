export async function streamChat({
  message,
  systemPrompt,
  provider,
  model,
  write,
  apiKey,
}) {
  const resolvedApiKey = apiKey || process.env.OPENAI_API_KEY
  const resolvedProvider = provider || "openai"
  const resolvedModel = model || process.env.OTTER_MODEL || "gpt-4.1-mini"

  // If ai-sdk is installed and API key is present, use it. Otherwise fallback to local echo.
  if (resolvedApiKey && resolvedProvider === "openai") {
    try {
      const [{ streamText }, { openai }] = await Promise.all([
        import("ai"),
        import("@ai-sdk/openai"),
      ])

      const result = streamText({
        model: openai(resolvedModel, {
          apiKey: resolvedApiKey,
        }),
        system: systemPrompt || undefined,
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

  const providerHint =
    resolvedProvider === "openai"
      ? ""
      : ` [provider "${resolvedProvider}" fallback to local echo]`
  const systemHint = systemPrompt ? `\nSystem: ${systemPrompt}` : ""
  write(`Echo${providerHint}${systemHint}\nUser: ${message}`)
}
