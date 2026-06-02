/**
 * Hardcoded Profile Tests
 *
 * Validates the exported HARDCODED_PROFILE object against the Zod schema.
 */

import { describe, expect, it } from 'vitest';
import { OrganizationProfileSchema } from '../../../../shared/schemas';
import { HARDCODED_PROFILE } from './hardcoded-profile';

describe('HARDCODED_PROFILE', () => {
  it('should match the OrganizationProfile Zod schema', () => {
    const result = OrganizationProfileSchema.safeParse(HARDCODED_PROFILE);
    expect(result.success).toBe(true);
  });

  it('should have required Hacker Dojo fields', () => {
    expect(HARDCODED_PROFILE.legalName).toBe('Hacker Dojo');
    expect(HARDCODED_PROFILE.ein).toBe('26-4812213');
    expect(HARDCODED_PROFILE.nonprofitStatus).toBe('501(c)(3)');
    expect(HARDCODED_PROFILE.yearFounded).toBe(2009);
    expect(HARDCODED_PROFILE.geography).toBe('San Francisco Bay Area / Silicon Valley');
    expect(HARDCODED_PROFILE.contactInfo.website).toBe('https://hackerdojo.org');
    expect(HARDCODED_PROFILE.samUEI).toBe('');
  });

  it('should have program areas', () => {
    expect(HARDCODED_PROFILE.programAreas.length).toBeGreaterThan(0);
    expect(HARDCODED_PROFILE.programAreas).toContain(
      'Makerspace operations (hardware labs, 3D printing, maker tools)',
    );
  });

  it('should have board members', () => {
    expect(HARDCODED_PROFILE.boardMembers.length).toBeGreaterThan(0);
    expect(HARDCODED_PROFILE.boardMembers[0]).toHaveProperty('name');
    expect(HARDCODED_PROFILE.boardMembers[0]).toHaveProperty('role');
  });

  it('should have agent behavior configuration', () => {
    expect(HARDCODED_PROFILE.agentBehavior.autoDraftThreshold).toBe(75);
    expect(HARDCODED_PROFILE.agentBehavior.submissionPolicy).toContain('Human approval required');
    expect(HARDCODED_PROFILE.agentBehavior.notifyEmail).toBe('ed@hackerdojo.com');
    expect(HARDCODED_PROFILE.agentBehavior.voiceAndTone).toContain('Plain-spoken');
  });
});
