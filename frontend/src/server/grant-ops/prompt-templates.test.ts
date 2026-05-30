/**
 * Prompt Templates Tests
 *
 * Verifies each prompt template contains:
 * - Artifact path
 * - Complete JSON schema
 * - Hardcoded Hacker Dojo profile
 * - Quality requirements
 * - No placeholder text ('TODO', 'FIXME')
 *
 * AC-15.7.1 compliance test.
 */

import { describe, expect, it } from 'vitest';
import { buildPrompt } from './prompt-templates';

const JOB_TYPES = [
  'research',
  'draft',
  'crawl',
  'match',
  'extract',
  'peer-discovery',
  'funder-insights',
  'eligibility-vetting',
  'budget-import',
] as const;

const PLACEHOLDER_PATTERNS = ['TODO', 'FIXME'];

describe('prompt-templates', () => {
  for (const jobType of JOB_TYPES) {
    describe(`${jobType} prompt`, () => {
      it('contains artifact path', () => {
        const prompt = buildPrompt(jobType as never, {}, '/tmp/test-artifact.json');
        expect(prompt).toContain('/tmp/test-artifact.json');
      });

      it('contains Hacker Dojo profile', () => {
        const prompt = buildPrompt(jobType as never, {}, '/tmp/test-artifact.json');
        expect(prompt).toContain('Hacker Dojo');
        expect(prompt).toContain('26-4812213');
      });

      it('contains quality requirements', () => {
        const prompt = buildPrompt(jobType as never, {}, '/tmp/test-artifact.json');
        expect(prompt).toContain('Quality Requirements');
      });

      it('contains no placeholder text (TODO or FIXME)', () => {
        const prompt = buildPrompt(jobType as never, {}, '/tmp/test-artifact.json');
        for (const pattern of PLACEHOLDER_PATTERNS) {
          expect(prompt).not.toContain(pattern);
        }
      });

      it('contains JSON schema', () => {
        const prompt = buildPrompt(jobType as never, {}, '/tmp/test-artifact.json');
        expect(prompt).toContain('"artifactType"');
      });

      it('includes organization context', () => {
        const prompt = buildPrompt(jobType as never, {}, '/tmp/test-artifact.json');
        expect(prompt).toContain('Organization Profile');
        expect(prompt).toContain('Mission:');
      });
    });
  }

  it('retry feedback is included when provided', () => {
    const prompt = buildPrompt('research', {}, '/tmp/test-artifact.json', 'Test error feedback');
    expect(prompt).toContain('Previous Attempt Failed');
    expect(prompt).toContain('Test error feedback');
  });

  it('hardcoded profile changes propagate to prompts', () => {
    // Verify EIN from HARDCODED_PROFILE is present in every prompt
    for (const jobType of JOB_TYPES) {
      const prompt = buildPrompt(jobType as never, {}, '/tmp/test-artifact.json');
      expect(prompt).toContain('26-4812213');
    }
  });
});
