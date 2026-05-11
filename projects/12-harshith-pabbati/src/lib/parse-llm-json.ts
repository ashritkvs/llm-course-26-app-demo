/**
 * Parse a JSON string that may be wrapped in markdown code fences.
 *
 * LLMs (especially Gemini) frequently wrap JSON output in markdown code fences
 * (e.g. ` ```json ... ``` `). This helper strips those fences before parsing so
 * callers don't silently lose valid responses.
 */
export function parseLLMJSON(text: string) {
  const stripped = text
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
  return JSON.parse(stripped);
}
