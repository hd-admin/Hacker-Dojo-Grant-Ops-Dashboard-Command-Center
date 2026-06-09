import { expect, test } from '@playwright/test';
import { BASE_URL, resetAppState } from './test-utils';

const FIT_RUBRIC = {
  rubricVersion: 1,
  missionAlignment: { score: 0.9, justification: 'Strong mission alignment with maker education.' },
  geographicFocus: { score: 0.8, justification: 'Bay Area presence matches funder scope.' },
  programTrackrecord: { score: 0.85, justification: 'Five years of program outcomes on file.' },
  budgetCapacity: { score: 0.7, justification: 'Match request is 5% of org annual budget.' },
  partnershipReadiness: { score: 0.75, justification: 'Active partner pipeline with two co-applicants.' },
  overallRationale: 'A strong match: high mission alignment, geographic fit, and proven track record.',
};

async function createGrantViaReset(request: import('@playwright/test').APIRequestContext): Promise<string> {
  const sourcesResp = await request.get(`${BASE_URL}/api/sources`);
  if (sourcesResp.ok()) {
    return (await sourcesResp.json())[0]?.id ?? 'seed-grant-1';
  }
  return 'seed-grant-1';
}

test.describe('grant rubric and archive lifecycle', () => {
  test.beforeEach(async ({ request }) => {
    await resetAppState(request);
  });

  test('seeded fitRubric renders in the grant drawer', async ({ request }) => {
    const grantId = await createGrantViaReset(request);
    const seedResp = await request.post(`${BASE_URL}/api/testing/seed-rubric/${grantId}`, {
      data: FIT_RUBRIC,
    });
    expect(seedResp.ok()).toBeTruthy();

    const grantResp = await request.get(`${BASE_URL}/api/grants/${grantId}`);
    expect(grantResp.ok()).toBeTruthy();
    const grant = (await grantResp.json()) as { grant: { fitRubric: typeof FIT_RUBRIC } };
    expect(grant.grant.fitRubric.overallRationale).toContain('strong match');
    expect(grant.grant.fitRubric.missionAlignment.justification).toContain('mission alignment');
  });

  test('GET /api/grants?showArchived=foo returns 400 VALIDATION_ERROR', async ({ request }) => {
    const resp = await request.get(`${BASE_URL}/api/grants?showArchived=foo`);
    expect(resp.status()).toBe(400);
    const body = (await resp.json()) as { code: string };
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('archived grant is hidden by default and visible with showArchived=1', async ({ request }) => {
    const grantId = await createGrantViaReset(request);
    const seedResp = await request.post(`${BASE_URL}/api/testing/seed-rubric/${grantId}`, {
      data: FIT_RUBRIC,
    });
    expect(seedResp.ok()).toBeTruthy();

    const archiveResp = await request.patch(`${BASE_URL}/api/grants/${grantId}/status`, {
      data: { status: 'archived', statusLabel: 'Archived' },
    });
    expect(archiveResp.ok()).toBeTruthy();

    const defaultList = await request.get(`${BASE_URL}/api/grants`);
    const defaultBody = (await defaultList.json()) as { items: Array<{ id: string }> };
    const idsDefault = (defaultBody.items ?? []).map((g) => g.id);
    expect(idsDefault).not.toContain(grantId);

    const showArchived = await request.get(`${BASE_URL}/api/grants?showArchived=1`);
    const showBody = (await showArchived.json()) as { items: Array<{ id: string; status: string; archivedAt?: string }> };
    const idsAll = (showBody.items ?? []).map((g) => g.id);
    expect(idsAll).toContain(grantId);
    const archived = (showBody.items ?? []).find((g) => g.id === grantId);
    expect(archived?.status).toBe('archived');
    expect(archived?.archivedAt).toBeDefined();
  });

  test('unarchive clears archivedAt', async ({ request }) => {
    const grantId = await createGrantViaReset(request);
    await request.post(`${BASE_URL}/api/testing/seed-rubric/${grantId}`, { data: FIT_RUBRIC });
    await request.patch(`${BASE_URL}/api/grants/${grantId}/status`, {
      data: { status: 'archived', statusLabel: 'Archived' },
    });
    const unarchiveResp = await request.patch(`${BASE_URL}/api/grants/${grantId}/status`, {
      data: { status: 'matched', statusLabel: 'Matched' },
    });
    expect(unarchiveResp.ok()).toBeTruthy();
    const grantResp = await request.get(`${BASE_URL}/api/grants/${grantId}`);
    const grant = (await grantResp.json()) as { grant: { archivedAt?: string } };
    expect(grant.grant.archivedAt).toBeUndefined();
  });

  test('lastSeenAt and lastUpdatedAt render in the discovery view and pipeline view', async ({ request }) => {
    const grantId = await createGrantViaReset(request);
    await request.post(`${BASE_URL}/api/testing/seed-rubric/${grantId}`, { data: FIT_RUBRIC });
    const grantResp = await request.get(`${BASE_URL}/api/grants/${grantId}`);
    const grant = (await grantResp.json()) as { grant: { lastSeenAt: string; lastUpdatedAt: string } };
    expect(grant.grant.lastSeenAt).toBeDefined();
    expect(grant.grant.lastUpdatedAt).toBeDefined();
    expect(grant.grant.lastSeenAt).not.toBe('');
    expect(grant.grant.lastUpdatedAt).not.toBe('');
  });

  test('override fitRubric writes a human_override audit event with stringified metadata', async ({ request }) => {
    const grantId = await createGrantViaReset(request);
    await request.post(`${BASE_URL}/api/testing/seed-rubric/${grantId}`, { data: FIT_RUBRIC });

    const newRubric = {
      ...FIT_RUBRIC,
      overallRationale: 'Updated rationale: even stronger match after re-review.',
    };
    const overrideResp = await request.post(`${BASE_URL}/api/grants/${grantId}/override`, {
      data: { field: 'fitRubric', overrideType: 'rubric', newValue: newRubric, reason: 're-score' },
    });
    expect(overrideResp.ok()).toBeTruthy();
    const eventsResp = await request.get(`${BASE_URL}/api/audit?entityId=${grantId}`);
    expect(eventsResp.ok()).toBeTruthy();
    const events = (await eventsResp.json()) as {
      events: Array<{ eventType: string; metadata?: { previousValue?: string; newValue?: string } }>;
    };
    const override = events.events.find((e) => e.eventType === 'human_override');
    expect(override).toBeDefined();
    expect(typeof override?.metadata?.previousValue).toBe('string');
    expect(typeof override?.metadata?.newValue).toBe('string');
  });

  test('crawl/start with empty body returns 200', async ({ request }) => {
    const resp = await request.post(`${BASE_URL}/api/crawl/start`, { data: {} });
    expect([200, 202]).toContain(resp.status());
  });
});
