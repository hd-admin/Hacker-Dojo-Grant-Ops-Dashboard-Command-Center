// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  invalidateCache,
  withTempDataDir,
} from '../../../../../../../shared/grant-ops-persistence';
import type { Grant } from '../../../../../../../shared/types';
import * as repository from '../../../../../server/grant-ops/repository';
import { PATCH, POST } from './route';

function createGrant(id: string): Grant {
  return {
    id,
    title: 'Test Grant for Status',
    funder: 'Test Funder',
    funderShort: 'TF',
    award: '$100,000',
    awardSort: 100000,
    deadline: '2026-12-31',
    daysOut: 180,
    fit: 85,
    tags: ['Test'],
    status: 'matched',
    statusLabel: 'Matched',
    matchedAt: '2026-05-01',
  };
}

describe('/api/grants/[grantId]/status', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;
  let grant: Grant;

  beforeEach(async () => {
    tempDataDir = await withTempDataDir();
    invalidateCache();
    grant = createGrant(`status-${Date.now()}`);
    await repository.addGrant(grant);
  });

  afterEach(async () => {
    await tempDataDir.cleanup();
    invalidateCache();
  });

  it('returns 404 when grant is missing', async () => {
    const response = await PATCH(
      new Request('http://localhost/api/grants/missing/status', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'draft', statusLabel: 'Drafting' }),
      }) as never,
      { params: Promise.resolve({ grantId: 'missing' }) },
    );

    expect(response.status).toBe(404);
  });

  it('updates status and label', async () => {
    const response = await PATCH(
      new Request(`http://localhost/api/grants/${grant.id}/status`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'draft', statusLabel: 'Drafting' }),
      }) as never,
      { params: Promise.resolve({ grantId: grant.id }) },
    );

    expect(response.status).toBe(200);
    expect((await repository.getGrant(grant.id))?.status).toBe('draft');
    expect((await repository.getGrant(grant.id))?.statusLabel).toBe('Drafting');
  });

  it('returns 400 for an invalid state transition', async () => {
    const response = await PATCH(
      new Request(`http://localhost/api/grants/${grant.id}/status`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'review', statusLabel: 'In Review' }),
      }) as never,
      { params: Promise.resolve({ grantId: grant.id }) },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe('INVALID_STATE_TRANSITION');
    expect(body.details.from).toBe('matched');
    expect(body.details.to).toBe('review');
  });

  it('returns 400 when submission-ready transition is blocked', async () => {
    // Set the grant to approved first
    await repository.updateGrant(grant.id, { status: 'approved', statusLabel: 'Approved' });

    const response = await PATCH(
      new Request(`http://localhost/api/grants/${grant.id}/status`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'submission-ready', statusLabel: 'Ready to Submit' }),
      }) as never,
      { params: Promise.resolve({ grantId: grant.id }) },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe('SUBMISSION_BLOCKED');
    expect(body.details.blockingReasons).toBeDefined();
    expect(body.details.blockingReasons.length).toBeGreaterThan(0);
  });

  it('returns 400 when submission-ready transition is blocked with blocking checklist items', async () => {
    // Create a grant in approved state with a submission-blocking checklist item
    const blockedGrant = createGrant(`status-blocked-${Date.now()}`);
    await repository.addGrant({
      ...blockedGrant,
      status: 'approved',
      statusLabel: 'Approved',
      checklist: [{ label: 'Final review', done: false, required: true, blockSubmission: true }],
    } as Grant);

    const response = await PATCH(
      new Request(`http://localhost/api/grants/${blockedGrant.id}/status`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'submission-ready', statusLabel: 'Ready to Submit' }),
      }) as never,
      { params: Promise.resolve({ grantId: blockedGrant.id }) },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe('SUBMISSION_BLOCKED');
    const reasons = body.details.blockingReasons as string[];
    expect(reasons.some((r) => r.includes('Final review'))).toBe(true);
  });

  it('returns 400 for a closed grant transition to anything other than archived', async () => {
    // Set the grant to closed first
    await repository.updateGrant(grant.id, { status: 'closed', statusLabel: 'Closed' });

    const response = await PATCH(
      new Request(`http://localhost/api/grants/${grant.id}/status`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'draft', statusLabel: 'Drafting' }),
      }) as never,
      { params: Promise.resolve({ grantId: grant.id }) },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe('INVALID_STATE_TRANSITION');
  });

  it('allows valid transition from draft to review', async () => {
    await repository.updateGrant(grant.id, { status: 'draft', statusLabel: 'Drafting' });

    const response = await PATCH(
      new Request(`http://localhost/api/grants/${grant.id}/status`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'review', statusLabel: 'In Review' }),
      }) as never,
      { params: Promise.resolve({ grantId: grant.id }) },
    );

    expect(response.status).toBe(200);
    expect((await repository.getGrant(grant.id))?.status).toBe('review');
  });

  it('allows valid transition from review back to draft for revisions', async () => {
    await repository.updateGrant(grant.id, { status: 'review', statusLabel: 'In Review' });

    const response = await PATCH(
      new Request(`http://localhost/api/grants/${grant.id}/status`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'draft', statusLabel: 'Drafting' }),
      }) as never,
      { params: Promise.resolve({ grantId: grant.id }) },
    );

    expect(response.status).toBe(200);
    expect((await repository.getGrant(grant.id))?.status).toBe('draft');
  });

  // ===== Method-reconciliation regression tests =====
  // PipelineView.tsx historically calls /api/grants/[id]/status
  // with method: 'POST' for the move-menu and decline flows. The
  // route now exports POST as an alias for PATCH; these tests lock
  // in that the alias continues to work and that the validation
  // surface is identical between the two methods.

  it('POST is accepted as an alias for PATCH and updates status', async () => {
    const response = await POST(
      new Request(`http://localhost/api/grants/${grant.id}/status`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'draft', statusLabel: 'Drafting' }),
      }) as never,
      { params: Promise.resolve({ grantId: grant.id }) },
    );

    expect(response.status).toBe(200);
    expect((await repository.getGrant(grant.id))?.status).toBe('draft');
  });

  it('POST and PATCH share the same validation surface (400 on bad payload)', async () => {
    const postResponse = await POST(
      new Request(`http://localhost/api/grants/${grant.id}/status`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'unknown' }),
      }) as never,
      { params: Promise.resolve({ grantId: grant.id }) },
    );
    const patchResponse = await PATCH(
      new Request(`http://localhost/api/grants/${grant.id}/status`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'unknown' }),
      }) as never,
      { params: Promise.resolve({ grantId: grant.id }) },
    );
    expect(postResponse.status).toBe(400);
    expect(patchResponse.status).toBe(400);
  });

  // ===== Archive / unarchive archivedAt contract =====

  it('PATCH status=archived sets archivedAt and writes an audit metadata entry', async () => {
    const before = (await repository.getGrant(grant.id))?.archivedAt;
    expect(before).toBeUndefined();

    const response = await PATCH(
      new Request(`http://localhost/api/grants/${grant.id}/status`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'archived', statusLabel: 'Archived' }),
      }) as never,
      { params: Promise.resolve({ grantId: grant.id }) },
    );
    expect(response.status).toBe(200);

    const after = await repository.getGrant(grant.id);
    expect(after?.status).toBe('archived');
    expect(after?.archivedAt).toBeDefined();
    expect(typeof after?.archivedAt).toBe('string');

    const events = await repository.getAuditEvents();
    const statusEvent = events.find((e) => e.eventType === 'grant_status_changed');
    expect(statusEvent?.metadata?.archivedAt).toBe(after?.archivedAt);
  });

  it('PATCH status=matched from archived clears archivedAt', async () => {
    // Archive first
    await PATCH(
      new Request(`http://localhost/api/grants/${grant.id}/status`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'archived', statusLabel: 'Archived' }),
      }) as never,
      { params: Promise.resolve({ grantId: grant.id }) },
    );
    const archived = await repository.getGrant(grant.id);
    expect(archived?.archivedAt).toBeDefined();

    // Unarchive via the matched status. matched->archived and archived->matched are
    // both legal transitions for the test fixture (status='matched' initial state).
    const response = await PATCH(
      new Request(`http://localhost/api/grants/${grant.id}/status`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'matched', statusLabel: 'Matched' }),
      }) as never,
      { params: Promise.resolve({ grantId: grant.id }) },
    );
    expect(response.status).toBe(200);
    const cleared = await repository.getGrant(grant.id);
    expect(cleared?.status).toBe('matched');
    expect(cleared?.archivedAt).toBeUndefined();
  });
});
