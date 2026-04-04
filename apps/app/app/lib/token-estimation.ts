import { estimateTokenCount } from "tokenx"
import type { TokenCounterPreset } from "./app-settings"

const TOKEN_COUNTER_OPTIONS: Record<
  TokenCounterPreset,
  { defaultCharsPerToken: number }
> = {
  chatgpt: { defaultCharsPerToken: 4 },
  claude: { defaultCharsPerToken: 4.2 },
}

export function estimateTokensForPreset(
  text: string,
  preset: TokenCounterPreset
) {
  return estimateTokenCount(text, TOKEN_COUNTER_OPTIONS[preset])
}
