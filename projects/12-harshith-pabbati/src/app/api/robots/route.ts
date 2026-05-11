/**
 * GET /api/robots?domain=https://example.com
 *
 * Discovers content URLs for the given domain by crawling its sitemaps:
 *  1. Checks robots.txt for Sitemap: declarations
 *  2. Falls back to well-known sitemap paths if none are found in robots.txt
 *  3. Parses sitemap XML — follows <sitemapindex> references, collects <urlset> <loc> entries
 *
 * Returns: { baseUrl, pages, sitemapUrls, groups }
 *   pages       – individual content page URLs extracted from sitemap urlset entries
 *   sitemapUrls – sitemap XML files that were successfully fetched
 *   groups      – pages keyed by first path segment (e.g. /docs, /blog) for UI grouping
 */

import { firstPathSegment } from '@/lib/url-section';

const FETCH_TIMEOUT_MS = 5_000;
const MAX_SITEMAPS = 20; // max sitemap files to fetch per request
const MAX_PAGES = 10000; // max page URLs to return

// Probe these paths if robots.txt has no Sitemap: directive
const FALLBACK_SITEMAP_PATHS = [
  '/sitemap.xml',
  '/sitemap_index.xml',
  '/sitemap-index.xml',
  '/sitemaps/sitemap.xml',
];

async function safeFetch(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Answerify-Bot/1.0' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    return res.ok ? res.text() : null;
  } catch {
    return null;
  }
}

/** Extract every <loc> value from a sitemap XML string. */
function extractLocs(xml: string): string[] {
  const locs: string[] = [];
  for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/gi)) {
    const url = match[1].trim();
    if (url) locs.push(url);
  }
  return locs;
}

function isSitemapIndex(xml: string): boolean {
  return /<sitemapindex[\s>]/i.test(xml);
}

/** Read only the Sitemap: lines from robots.txt — ignore Allow/Disallow. */
function parseSitemapsFromRobots(text: string): string[] {
  const urls: string[] = [];
  for (const rawLine of text.split('\n')) {
    const m = rawLine.trim().match(/^Sitemap:\s*(.+)$/i);
    if (m) urls.push(m[1].trim());
  }
  return urls;
}

/**
 * BFS crawl: follow sitemapindex → child sitemaps, collect <loc> from urlsets.
 * Stops once MAX_SITEMAPS files have been fetched or MAX_PAGES pages collected.
 */
async function crawlSitemaps(initialUrls: string[]): Promise<{
  pages: string[];
  sitemapsFetched: string[];
}> {
  const pages: string[] = [];
  const sitemapsFetched: string[] = [];
  const seen = new Set<string>();
  const queue = [...initialUrls];

  while (
    queue.length > 0 &&
    sitemapsFetched.length < MAX_SITEMAPS &&
    pages.length < MAX_PAGES
  ) {
    const url = queue.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);

    const text = await safeFetch(url);
    if (!text) continue;

    sitemapsFetched.push(url);
    const locs = extractLocs(text);

    if (isSitemapIndex(text)) {
      // Queue child sitemaps (not yet seen)
      for (const loc of locs) {
        if (!seen.has(loc)) queue.push(loc);
      }
    } else {
      // Regular urlset — collect page URLs up to the cap
      for (const loc of locs) {
        if (pages.length >= MAX_PAGES) break;
        pages.push(loc);
      }
      // Exit the outer loop immediately if we've hit the page cap
      if (pages.length >= MAX_PAGES) break;
    }
  }

  return { pages, sitemapsFetched };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get('domain');

  if (!domain) {
    return Response.json(
      { error: 'domain query parameter is required' },
      { status: 400 }
    );
  }

  let baseUrl: string;
  try {
    const parsed = new URL(
      domain.startsWith('http') ? domain : `https://${domain}`
    );
    baseUrl = `${parsed.protocol}//${parsed.host}`;
  } catch {
    return Response.json({ error: 'Invalid domain' }, { status: 400 });
  }

  // Step 1 — find sitemap URLs via robots.txt
  let sitemapUrls: string[] = [];
  const robotsText = await safeFetch(`${baseUrl}/robots.txt`);
  if (robotsText) {
    sitemapUrls = parseSitemapsFromRobots(robotsText);
  }

  // Step 2 — probe common sitemap locations if robots.txt had no Sitemap: line
  if (sitemapUrls.length === 0) {
    for (const path of FALLBACK_SITEMAP_PATHS) {
      const url = `${baseUrl}${path}`;
      const text = await safeFetch(url);
      if (text && (/<urlset/i.test(text) || /<sitemapindex/i.test(text))) {
        sitemapUrls.push(url);
        break; // one starting point is enough; crawlSitemaps follows indexes
      }
    }
  }

  // Step 3 — crawl sitemaps to gather individual page URLs
  const { pages, sitemapsFetched } = await crawlSitemaps(sitemapUrls);

  return Response.json({
    baseUrl,
    pages,
    sitemapUrls: sitemapsFetched,
    groups: groupBySection(pages),
  });
}

/** Group page URLs by their first path segment (e.g. /docs, /blog). */
function groupBySection(pages: string[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  for (const page of pages) {
    const seg = firstPathSegment(page);
    const key = seg ? `/${seg}` : '/';
    (groups[key] ??= []).push(page);
  }
  return groups;
}
