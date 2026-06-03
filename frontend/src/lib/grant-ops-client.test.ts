import { describe, it, expect, vi, beforeEach } from 'vitest';
import { client } from './grant-ops-client';

describe('grant-ops-client', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
  });

  describe('client structure', () => {
    it('exports a client object with expected method groups', () => {
      expect(client).toBeDefined();
      expect(typeof client).toBe('object');

      expect(client.sources).toBeDefined();
      expect(client.research).toBeDefined();
      expect(client.grants).toBeDefined();
      expect(client.drafts).toBeDefined();
      expect(client.approvals).toBeDefined();
      expect(client.submit).toBeDefined();
      expect(client.manifest).toBeDefined();
      expect(client.jobs).toBeDefined();
      expect(client.followUps).toBeDefined();
      expect(client.profile).toBeDefined();
      expect(client.revisions).toBeDefined();
      expect(client.notifications).toBeDefined();
      expect(client.tasks).toBeDefined();
      expect(client.documents).toBeDefined();
      expect(client.duplicates).toBeDefined();
      expect(client.backup).toBeDefined();
      expect(client.themes).toBeDefined();
    });

    it('has callable methods on the grants group (grant-ops-client grantsApi)', () => {
      expect(typeof client.grants.getAll).toBe('function');
      expect(typeof client.grants.getById).toBe('function');
      expect(typeof client.grants.update).toBe('function');
      expect(typeof client.grants.updateStatus).toBe('function');
      expect(typeof client.grants.override).toBe('function');
    });

    it('has callable methods on the jobs group', () => {
      expect(typeof client.jobs.get).toBe('function');
      expect(typeof client.jobs.retry).toBe('function');
    });

    it('has callable methods on the followUps group', () => {
      expect(typeof client.followUps.getAll).toBe('function');
      expect(typeof client.followUps.getFiltered).toBe('function');
      expect(typeof client.followUps.create).toBe('function');
      expect(typeof client.followUps.update).toBe('function');
      expect(typeof client.followUps.delete).toBe('function');
    });

    it('has callable methods on the tasks group', () => {
      expect(typeof client.tasks.getAll).toBe('function');
      expect(typeof client.tasks.update).toBe('function');
      expect(typeof client.tasks.create).toBe('function');
      expect(typeof client.tasks.override).toBe('function');
    });

    it('has awards and settings method groups', () => {
      expect(client.awards).toBeDefined();
      expect(typeof client.awards.getAll).toBe('function');
      expect(typeof client.awards.create).toBe('function');
      expect(typeof client.awards.getSpenddownAlerts).toBe('function');
      expect(typeof client.awards.getCalendar).toBe('function');
      expect(typeof client.awards.getExpenses).toBe('function');
      expect(typeof client.awards.createExpense).toBe('function');
      expect(typeof client.awards.getBudgetVsActual).toBe('function');
      expect(typeof client.awards.getCompliance).toBe('function');
      expect(typeof client.awards.createCompliance).toBe('function');
      expect(typeof client.awards.getReports).toBe('function');
      expect(typeof client.awards.createReport).toBe('function');

      expect(client.settings).toBeDefined();
      expect(typeof client.settings.get).toBe('function');
      expect(typeof client.settings.update).toBe('function');
    });
  });

  describe('API calls via fetch', () => {
    it('constructs the correct URL for grants.getAll', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [], page: 1, pageSize: 25, total: 0 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await client.grants.getAll();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const fetchUrl = mockFetch.mock.calls[0]?.[0] as string;
      expect(fetchUrl).toBe('/api/grants');
    });

    it('constructs the correct URL for grants.getAll with pagination params', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [], page: 2, pageSize: 10, total: 30 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await client.grants.getAll({ page: 2, pageSize: 10 });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const fetchUrl = mockFetch.mock.calls[0]?.[0] as string;
      expect(fetchUrl).toBe('/api/grants?page=2&pageSize=10');
    });

    it('constructs the correct URL for grants.getById with encoded grantId', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await client.grants.getById('test-id');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const fetchUrl = mockFetch.mock.calls[0]?.[0] as string;
      expect(fetchUrl).toBe('/api/grants/test-id');
    });

    it('constructs the correct URL for jobs.get with encoded jobId', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await client.jobs.get('job-123');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const fetchUrl = mockFetch.mock.calls[0]?.[0] as string;
      expect(fetchUrl).toBe('/api/jobs/job-123');
    });

    it('constructs the correct URL for followUps.getFiltered with query params', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await client.followUps.getFiltered({ grantId: 'g-1', status: 'open' });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const fetchUrl = mockFetch.mock.calls[0]?.[0] as string;
      expect(fetchUrl).toContain('/api/follow-ups');
      expect(fetchUrl).toContain('grantId=g-1');
      expect(fetchUrl).toContain('status=open');
    });

    it('sets Content-Type header for JSON requests', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await client.grants.update('grant-1', { funderSummary: 'Updated funder info' });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const options = mockFetch.mock.calls[0]?.[1] as RequestInit | undefined;
      expect(options).toBeDefined();
      expect(options?.method).toBe('PATCH');
      expect(options?.headers).toBeDefined();
      const headers = options?.headers as Headers;
      expect(headers.get('Content-Type')).toBe('application/json');
    });

    it('constructs the correct URL for awards.getAll', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ awards: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await client.awards.getAll();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const fetchUrl = mockFetch.mock.calls[0]?.[0] as string;
      expect(fetchUrl).toBe('/api/awards');
    });

    it('constructs the correct URL for awards.getExpenses with encoded awardId', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ expenses: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await client.awards.getExpenses('award-1');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const fetchUrl = mockFetch.mock.calls[0]?.[0] as string;
      expect(fetchUrl).toBe('/api/awards/expenses?awardId=award-1');
    });

    it('constructs the correct URL for awards.getBudgetVsActual with encoded awardId', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ rows: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await client.awards.getBudgetVsActual('award-2');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const fetchUrl = mockFetch.mock.calls[0]?.[0] as string;
      expect(fetchUrl).toBe('/api/awards/award-2/budget-vs-actual');
    });

    it('constructs the correct URL for settings.get', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await client.settings.get();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const fetchUrl = mockFetch.mock.calls[0]?.[0] as string;
      expect(fetchUrl).toBe('/api/settings');
    });

    it('sends PUT with JSON body for settings.update', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await client.settings.update({ operatorName: 'Alice' });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const options = mockFetch.mock.calls[0]?.[1] as RequestInit | undefined;
      expect(options?.method).toBe('PUT');
      expect(JSON.parse(options?.body as string)).toEqual({ operatorName: 'Alice' });
    });
  });

  describe('error handling', () => {
    it('throws an error on non-2xx response with JSON error body', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Grant not found' }), { status: 404 }),
      );

      await expect(client.grants.getById('missing')).rejects.toThrow('Grant not found');
    });

    it('throws Unknown error when response body is not JSON', async () => {
      mockFetch.mockResolvedValueOnce(new Response('plain text error', { status: 500 }));

      await expect(client.grants.getAll()).rejects.toThrow('Unknown error');
    });

    it('throws an error with status-based message when response has no error field', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ other: 'data' }), { status: 403 }),
      );

      await expect(client.grants.getAll()).rejects.toThrow('API error: 403');
    });

    it('handles network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      await expect(client.grants.getAll()).rejects.toThrow('Network failure');
    });

    it('handles malformed JSON on 2xx response with graceful error message', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('not valid json {{{', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await expect(client.grants.getAll()).rejects.toThrow('Malformed response body');
    });
  });
});
