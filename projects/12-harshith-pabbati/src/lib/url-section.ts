/**
 * Returns the first non-empty path segment of a URL (e.g. "/docs" from
 * "https://example.com/docs/getting-started"), or null when the URL has no
 * meaningful path.  Used for section-level grouping of page URLs both in the
 * discovery API and in the Gemini deduplication logic.
 */
export function firstPathSegment(url: string): string | null {
  try {
    const { pathname } = new URL(url);
    return pathname.split('/').find(Boolean) ?? null;
  } catch {
    return null;
  }
}
