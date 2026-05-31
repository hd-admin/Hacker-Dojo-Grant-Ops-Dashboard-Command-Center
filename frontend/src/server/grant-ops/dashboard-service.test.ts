import { describe, it, expect } from 'vitest';
import {
  generatePipelineReport,
  generateFundraisingForecast,
  generateAnnualSummary,
} from './dashboard-service';
import type { Grant } from '../../../../shared/types';

function makeGrant(overrides: Partial<Grant> = {}): Grant {
  return {
    id: 'g-1',
    title: 'Test Grant',
    funder: 'Test Funder',
    funderShort: 'TF',
    award: '$10K',
    awardSort: 10000,
    deadline: '2026-06-15',
    daysOut: 30,
    fit: 85,
    tags: [],
    status: 'matched',
    statusLabel: 'Matched',
    matchedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('generatePipelineReport', () => {
  it('filters out awarded, archived, and declined grants', () => {
    const grants: Grant[] = [
      makeGrant({ id: 'g1', status: 'matched', statusLabel: 'Matched' }),
      makeGrant({ id: 'g2', status: 'awarded', statusLabel: 'Awarded' }),
      makeGrant({ id: 'g3', status: 'archived', statusLabel: 'Archived' }),
      makeGrant({ id: 'g4', status: 'declined', statusLabel: 'Declined' }),
      makeGrant({ id: 'g5', status: 'submitted', statusLabel: 'Submitted' }),
    ];
    const report = generatePipelineReport(grants);
    expect(report).toHaveLength(2);
    expect(report.map((r) => r.status)).toEqual(['Matched', 'Submitted']);
  });

  it('maps grant fields correctly', () => {
    const grants: Grant[] = [
      makeGrant({
        id: 'g1',
        title: 'My Grant',
        funder: 'My Funder',
        status: 'approved',
        statusLabel: 'Approved',
        deadline: '2026-07-01',
        awardSort: 50000,
        daysOut: 45,
        responsibilityTag: 'finance',
      }),
    ];
    const report = generatePipelineReport(grants);
    expect(report[0]).toEqual({
      title: 'My Grant',
      funder: 'My Funder',
      status: 'Approved',
      deadline: '2026-07-01',
      awardAmount: 50000,
      daysOut: 45,
      responsibilityTag: 'finance',
    });
  });
});

describe('generateFundraisingForecast', () => {
  it('counts approved/submission-ready grants with deadlines within 90 days', () => {
    const now = new Date();
    const future30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const future100 = new Date(now.getTime() + 100 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const grants: Grant[] = [
      makeGrant({ id: 'g1', status: 'approved', statusLabel: 'Approved', deadline: future30 }),
      makeGrant({ id: 'g2', status: 'submission-ready', statusLabel: 'Submission Ready', deadline: future30 }),
      makeGrant({ id: 'g3', status: 'approved', statusLabel: 'Approved', deadline: future100 }),
      makeGrant({ id: 'g4', status: 'matched', statusLabel: 'Matched', deadline: future30 }),
    ];
    const forecast = generateFundraisingForecast(grants);
    expect(forecast.projectedSubmissions90d).toBe(2);
  });

  it('calculates projected award value with historical success rate', () => {
    const now = new Date();
    const future30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const pastYear = new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000).toISOString();
    const grants: Grant[] = [
      makeGrant({ id: 'g1', status: 'approved', statusLabel: 'Approved', awardSort: 100000, deadline: future30 }),
      // Need at least 5 submitted in trailing 24 months for success rate
      ...Array.from({ length: 5 }, (_, i) => makeGrant({ id: `g-sub-${i}`, status: 'submitted', statusLabel: 'Submitted', awardSort: 50000, matchedAt: pastYear })),
      makeGrant({ id: 'g3', status: 'awarded', statusLabel: 'Awarded', awardSort: 50000, matchedAt: pastYear }),
    ];
    const forecast = generateFundraisingForecast(grants);
    // success rate = 1/5 = 0.2, projected = 100000 * 0.2 = 20000
    expect(forecast.projectedAwardValue).toBe(20000);
  });

  it('returns 0 success rate when fewer than 5 submitted', () => {
    const now = new Date();
    const future30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const grants: Grant[] = [
      makeGrant({ id: 'g1', status: 'approved', statusLabel: 'Approved', awardSort: 100000, deadline: future30 }),
    ];
    const forecast = generateFundraisingForecast(grants);
    expect(forecast.projectedAwardValue).toBe(0);
  });

  it('identifies at-risk grants with deadlines within 14 days', () => {
    const now = new Date();
    const future7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const future30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const grants: Grant[] = [
      makeGrant({ id: 'g1', status: 'matched', statusLabel: 'Matched', deadline: future7 }),
      makeGrant({ id: 'g2', status: 'approved', statusLabel: 'Approved', deadline: future7 }),
      makeGrant({ id: 'g3', status: 'submitted', statusLabel: 'Submitted', deadline: future7 }),
      makeGrant({ id: 'g4', status: 'matched', statusLabel: 'Matched', deadline: future30 }),
    ];
    const forecast = generateFundraisingForecast(grants);
    expect(forecast.atRiskGrants).toHaveLength(2);
    expect(forecast.atRiskGrants.map((g) => g.id)).toContain('g1');
    expect(forecast.atRiskGrants.map((g) => g.id)).toContain('g2');
  });
});

describe('generateAnnualSummary', () => {
  it('calculates totals and success rate', () => {
    const grants: Grant[] = [
      makeGrant({ id: 'g1', status: 'submitted', statusLabel: 'Submitted' }),
      makeGrant({ id: 'g2', status: 'awarded', statusLabel: 'Awarded' }),
      makeGrant({ id: 'g3', status: 'awarded', statusLabel: 'Awarded' }),
      makeGrant({ id: 'g4', status: 'matched', statusLabel: 'Matched' }),
    ];
    const summary = generateAnnualSummary(grants);
    expect(summary.totalGrantsSubmitted).toBe(3);
    expect(summary.totalAwarded).toBe(2);
    expect(summary.successRate).toBeCloseTo(2 / 3);
  });

  it('ranks top funders by awarded amount', () => {
    const grants: Grant[] = [
      makeGrant({ id: 'g1', status: 'awarded', statusLabel: 'Awarded', funder: 'Funder A', awardSort: 100000 }),
      makeGrant({ id: 'g2', status: 'awarded', statusLabel: 'Awarded', funder: 'Funder B', awardSort: 200000 }),
      makeGrant({ id: 'g3', status: 'awarded', statusLabel: 'Awarded', funder: 'Funder A', awardSort: 50000 }),
    ];
    const summary = generateAnnualSummary(grants);
    expect(summary.topFunders).toHaveLength(2);
    expect(summary.topFunders[0]).toEqual({ funder: 'Funder B', totalAwarded: 200000 });
    expect(summary.topFunders[1]).toEqual({ funder: 'Funder A', totalAwarded: 150000 });
  });

  it('collects lessons learned from declined grants', () => {
    const grants: Grant[] = [
      makeGrant({ id: 'g1', status: 'declined', statusLabel: 'Declined', title: 'Grant 1', funder: 'Funder X', lessonsLearned: 'Need better alignment' }),
      makeGrant({ id: 'g2', status: 'declined', statusLabel: 'Declined', title: 'Grant 2', funder: 'Funder Y' }),
      makeGrant({ id: 'g3', status: 'matched', statusLabel: 'Matched' }),
    ];
    const summary = generateAnnualSummary(grants);
    expect(summary.lessonsLearned).toHaveLength(1);
    expect(summary.lessonsLearned[0]).toEqual({
      grantTitle: 'Grant 1',
      funder: 'Funder X',
      note: 'Need better alignment',
    });
  });
});
