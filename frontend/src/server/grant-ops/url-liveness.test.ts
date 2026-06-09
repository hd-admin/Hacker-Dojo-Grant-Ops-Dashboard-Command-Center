import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkUrlLiveness, checkUrlsLiveness } from './url-liveness';

function mockFetchStatus(status: number): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      status,
      body: { cancel: async () => {} },
    })),
  );
}

describe('url-liveness', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('classifies a 200 as live', async () => {
    mockFetchStatus(200);
    expect(await checkUrlLiveness('https://example.com/grant')).toBe('live');
  });

  it('classifies a 301/302 redirect as live', async () => {
    mockFetchStatus(301);
    expect(await checkUrlLiveness('https://example.com/old')).toBe('live');
  });

  it('classifies a 404 as dead', async () => {
    mockFetchStatus(404);
    expect(await checkUrlLiveness('https://example.com/missing')).toBe('dead');
  });

  it('classifies a 410 as dead', async () => {
    mockFetchStatus(410);
    expect(await checkUrlLiveness('https://example.com/gone')).toBe('dead');
  });

  it('classifies a 403/429/5xx as unknown (do not drop on uncertainty)', async () => {
    mockFetchStatus(403);
    expect(await checkUrlLiveness('https://example.com/blocked')).toBe('unknown');
    mockFetchStatus(503);
    expect(await checkUrlLiveness('https://example.com/down')).toBe('unknown');
  });

  it('treats a malformed / non-http URL as dead without fetching', async () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    expect(await checkUrlLiveness('not-a-url')).toBe('dead');
    expect(await checkUrlLiveness('/relative/path')).toBe('dead');
    expect(spy).not.toHaveBeenCalled();
  });

  it('returns unknown on network error/timeout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );
    expect(await checkUrlLiveness('https://example.com/x')).toBe('unknown');
  });

  it('checkUrlsLiveness de-duplicates and maps each url to a status', async () => {
    mockFetchStatus(200);
    const map = await checkUrlsLiveness([
      'https://a.com/1',
      'https://a.com/1',
      undefined,
      'https://b.com/2',
    ]);
    expect(map.get('https://a.com/1')).toBe('live');
    expect(map.get('https://b.com/2')).toBe('live');
    expect(map.size).toBe(2);
  });
});
