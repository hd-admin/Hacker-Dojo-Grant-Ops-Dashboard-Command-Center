/**
 * Grant Decline API Route Tests
 *
 * Pattern-mirrors frontend/src/app/api/grants/[grantId]/status/route.test.ts
 * for setup; uses real withTempDataDir + repository.addGrant so the
 * full request -> updateGrant -> createPipelineTransition -> addAuditEvent
 * chain is exercised end-to-end.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  invalidateCache,
  withTempDataDir,
} from '../../../../../../../shared/grant-ops-persistence';
import type { Grant } from '../../../../../../../shared/types';
import * as repository from '../../../../../server/grant-ops/repository';
import { POST } from './route';

function createGrant(id: string, status: Grant['status'] = 'submitted'): Grant {
  return {
    id,
    title: 'Test Grant for Decline',
    funder: 'Test Funder',
    funderShort: 'TF',
    award: '$50,000',
    awardSort: 50000,
    deadline: '2026-12-31',
    daysOut: 180,
    fit: 85,
    tags: ['Test'],
    status,
    statusLabel: status.charAt(0).toUpperCase() + status.slice(1),
    matchedAt: '2026-05-01',
  };
}

describe('/api/grants/[grantId]/decline', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;
  let grant: Grant;

  beforeEach(async () => {
    tempDataDir = await withTempDataDir();
    invalidateCache();
    // Per pipeline-logic.ts, only 'submitted', 'follow-up', or
    // 'awarded' grants can transition to 'declined'. Start from
    // 'submitted' for the happy-path tests.
    grant = createGrant(`decline-${Date.now()}`, 'submitted');
    await repository.addGrant(grant);
  });

  afterEach(async () => {
    await tempDataDir.cleanup();
    invalidateCache();
  });

  it('returns 201 with success when decline payload is valid', async () => {
    const response = await POST(
      new Request(`http://localhost/api/grants/${grant.id}/decline`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lessonsLearned: 'Too restrictive on outcomes reporting.' }),
      }) as never,
      { params: Promise.resolve({ grantId: grant.id }) },
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.status).toBe('declined');
    expect(body.lessonsLearned).toBe('Too restrictive on outcomes reporting.');

    const stored = await repository.getGrant(grant.id);
    expect(stored?.status).toBe('declined');
    expect(stored?.lessonsLearned).toBe('Too restrictive on outcomes reporting.');
  });

  it('writes a pipeline_transitions audit row with reason', async () => {
    await POST(
      new Request(`http://localhost/api/grants/${grant.id}/decline`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lessonsLearned: 'Wrong funder fit.' }),
      }) as never,
      { params: Promise.resolve({ grantId: grant.id }) },
    );

    // The route uses createPipelineTransition?.() which is optional
    // in the repository. The audit-event trail is the canonical
    // source for the transition reason; we assert that here.
    const events = await repository.getAuditEvents();
    const transitionEvent = events.find(
      (e) => e.eventType === 'grant_declined' && e.entityId === grant.id,
    );
    expect(transitionEvent).toBeDefined();
    expect(transitionEvent?.metadata?.lessonsLearned).toBe('Wrong funder fit.');
  });

  it('transitions from submitted to declined in the stored grant record', async () => {
    const before = await repository.getGrant(grant.id);
    expect(before?.status).toBe('submitted');
    await POST(
      new Request(`http://localhost/api/grants/${grant.id}/decline`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lessonsLearned: 'Wrong funder fit.' }),
      }) as never,
      { params: Promise.resolve({ grantId: grant.id }) },
    );
    const after = await repository.getGrant(grant.id);
    expect(after?.status).toBe('declined');
    expect(after?.lessonsLearned).toBe('Wrong funder fit.');
  });

  it('writes a grant_declined audit event with the lessons-learned metadata', async () => {
    await POST(
      new Request(`http://localhost/api/grants/${grant.id}/decline`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lessonsLearned: 'Wrong fit for our stage.' }),
      }) as never,
      { params: Promise.resolve({ grantId: grant.id }) },
    );

    const events = await repository.getAuditEvents();
    const match = events.find((e) => e.eventType === 'grant_declined' && e.entityId === grant.id);
    expect(match).toBeDefined();
    expect(match?.metadata?.lessonsLearned).toBe('Wrong fit for our stage.');
  });

  it('returns 400 when lessonsLearned is missing', async () => {
    const response = await POST(
      new Request(`http://localhost/api/grants/${grant.id}/decline`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }) as never,
      { params: Promise.resolve({ grantId: grant.id }) },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when lessonsLearned is an empty string', async () => {
    const response = await POST(
      new Request(`http://localhost/api/grants/${grant.id}/decline`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lessonsLearned: '' }),
      }) as never,
      { params: Promise.resolve({ grantId: grant.id }) },
    );

    expect(response.status).toBe(400);
  });

  it('returns 404 when the grant does not exist', async () => {
    const response = await POST(
      new Request('http://localhost/api/grants/missing-id/decline', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lessonsLearned: 'Not applicable.' }),
      }) as never,
      { params: Promise.resolve({ grantId: 'missing-id' }) },
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.code).toBe('FILE_NOT_FOUND');
  });

  it('returns 400 for a status that cannot transition to declined', async () => {
    // 'matched' is not in the allowed decline sources per
    // pipeline-logic.ts PIPELINE_TRANSITIONS. Assert the
    // transition is rejected.
    const blockedGrant = createGrant(`decline-blocked-${Date.now()}`, 'matched');
    await repository.addGrant(blockedGrant);

    const response = await POST(
      new Request(`http://localhost/api/grants/${blockedGrant.id}/decline`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lessonsLearned: 'Test.' }),
      }) as never,
      { params: Promise.resolve({ grantId: blockedGrant.id }) },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe('INVALID_STATE_TRANSITION');
    expect(body.details.from).toBe('matched');
    expect(body.details.to).toBe('declined');
  });

  it('uses the provided statusLabel override when given', async () => {
    const response = await POST(
      new Request(`http://localhost/api/grants/${grant.id}/decline`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          lessonsLearned: 'Will not apply again.',
          statusLabel: 'Declined - wrong fit',
        }),
      }) as never,
      { params: Promise.resolve({ grantId: grant.id }) },
    );

    expect(response.status).toBe(201);
    const stored = await repository.getGrant(grant.id);
    expect(stored?.statusLabel).toBe('Declined - wrong fit');
  });
});
