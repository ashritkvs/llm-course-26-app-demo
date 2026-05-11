export const AUTOPILOT_ENABLED_DEFAULT = true;
export const AUTOPILOT_THRESHOLD_DEFAULT = 0.65;

// Fallback confidence when URL context is used but no grounding scores
// are returned. Set above the default threshold to allow autopilot for
// URL-sourced replies that Gemini answered without explicit grounding data.
export const URL_CONTEXT_FALLBACK_CONFIDENCE = 0.7;
