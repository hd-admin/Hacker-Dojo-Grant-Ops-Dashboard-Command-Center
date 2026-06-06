import { describe, expect, it } from 'vitest';
import { SEED_FUNDERS, SEED_SOURCES, SEED_SCHEDULES } from './seed-funders';

describe('seed-funders', () => {
  it('exports SEED_FUNDERS with valid funder profiles', () => {
    expect(SEED_FUNDERS).toBeDefined();
    expect(SEED_FUNDERS.length).toBeGreaterThan(0);
    expect(SEED_FUNDERS[0]!.id).toBeDefined();
    expect(SEED_FUNDERS[0]!.name).toBeDefined();
    expect(SEED_FUNDERS[0]!.type).toBeDefined();
    expect(Array.isArray(SEED_FUNDERS[0]!.givingHistory)).toBe(true);
  });

  it('exports SEED_SOURCES with valid sources', () => {
    expect(SEED_SOURCES).toBeDefined();
    expect(SEED_SOURCES.length).toBeGreaterThan(0);
    expect(SEED_SOURCES[0]!.id).toBeDefined();
    expect(SEED_SOURCES[0]!.name).toBeDefined();
    expect(SEED_SOURCES[0]!.url).toBeDefined();
  });

  it('exports SEED_SCHEDULES with valid schedules', () => {
    expect(SEED_SCHEDULES).toBeDefined();
    expect(SEED_SCHEDULES.length).toBeGreaterThan(0);
    expect(SEED_SCHEDULES[0]!.id).toBeDefined();
    expect(SEED_SCHEDULES[0]!.sourceId).toBeDefined();
    expect(typeof SEED_SCHEDULES[0]!.intervalHours).toBe('number');
  });
});
