import 'server-only';
import { logger } from '@/lib/logger';

/**
 * URL liveness checking for crawled grants.
 *
 * LLM agents sometimes return plausible-looking but non-existent source URLs (guessed
 * slugs/IDs). Before a grant is ingested we actually VISIT its source URL and classify
 * the result, so we never surface a grant whose "View source" link 404s.
 *
 * - 'live'    : resolved 2xx/3xx — the page exists.
 * - 'dead'    : 404/410, or a malformed/non-http URL — definitively broken; drop it.
 * - 'unknown' : 403/429/5xx/timeout/network error — could not confirm either way, so we
 *               keep the grant rather than discard a real opportunity on a transient or
 *               bot-blocked response.
 */
export type UrlLiveness = 'live' | 'dead' | 'unknown';

const USER_AGENT =
  'Mozilla/5.0 (compatible; HackerDojoGrantBot/1.0; +https://hackerdojo.com)';

export async function checkUrlLiveness(url: string, timeoutMs = 10000): Promise<UrlLiveness> {
  if (!url || !/^https?:\/\/\S+\.\S+/i.test(url)) {
    return 'dead';
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/json,*/*' },
    });
    // We only need the status; discard the body so we do not download whole pages.
    try {
      await res.body?.cancel();
    } catch {
      // ignore body-cancel errors
    }
    if (res.status === 404 || res.status === 410) return 'dead';
    if (res.status >= 200 && res.status < 400) return 'live';
    return 'unknown';
  } catch {
    // Timeout, DNS failure, connection reset, etc. — cannot confirm dead.
    return 'unknown';
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Check many URLs with bounded concurrency. De-duplicates first so the same URL is only
 * fetched once. Returns a Map keyed by the original URL string.
 */
export async function checkUrlsLiveness(
  urls: Array<string | undefined>,
  concurrency = 8,
): Promise<Map<string, UrlLiveness>> {
  const unique = [...new Set(urls.filter((u): u is string => !!u))];
  const result = new Map<string, UrlLiveness>();
  for (let i = 0; i < unique.length; i += concurrency) {
    const batch = unique.slice(i, i + concurrency);
    const statuses = await Promise.all(batch.map((u) => checkUrlLiveness(u)));
    batch.forEach((u, idx) => result.set(u, statuses[idx]!));
  }
  const dead = [...result.values()].filter((s) => s === 'dead').length;
  if (dead > 0) {
    logger.warn({ dead, total: unique.length }, 'Crawl URL liveness check found dead source links');
  }
  return result;
}
