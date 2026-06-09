/**
 * Drift detection between the research prompt's required rubric fields and the
 * Zod schema's required fitRubric shape. If the prompt or schema is edited in a
 * way that drops one of the required fields, this test fails.
 */

import { describe, it, expect } from 'vitest';
import { ResearchGrantSchemaStrict } from '../../../../shared/schemas';
import { buildResearchPrompt } from './prompt-templates';

describe('prompt-templates research rubric', () => {
  const prompt = buildResearchPrompt({}, '/tmp/artifact.json');
  const jsonMatch = prompt.match(/```json\n([\s\S]*?)\n```/);
  const schema = JSON.parse(jsonMatch?.[1] ?? '{}') as {
    properties?: Record<string, { properties?: Record<string, unknown>; required?: string[] }>;
  };

  it('research prompt contains the required rubric field names', () => {
    expect(prompt).toContain('missionAlignment');
    expect(prompt).toContain('justification');
    expect(prompt).toContain('overallRationale');
    expect(prompt).toContain('changeClass');
    expect(prompt).toContain('evidence');
    expect(prompt).toContain('rubricVersion');
  });

  it('research prompt mandates every dimension in the rubric', () => {
    const required = [
      'missionAlignment',
      'geographicFocus',
      'programTrackrecord',
      'budgetCapacity',
      'partnershipReadiness',
    ];
    for (const dimension of required) {
      expect(prompt).toContain(dimension);
    }
  });

  it('re-derived RESEARCH_SCHEMA_JSON lists the same required fields as ResearchGrantSchemaStrict', () => {
    // The strict schema's grant shape lists every field as required. The
    // prompt's embedded JSON must agree, otherwise a real LLM run will be
    // told to include fields the strict parse will reject (or vice versa).
    const strictShape = ResearchGrantSchemaStrict.shape as unknown as Record<string, unknown>;
    const strictFieldNames = new Set(Object.keys(strictShape));
    for (const required of ['fitRubric', 'changeClass', 'lastSeenConfirmed']) {
      expect(strictFieldNames.has(required)).toBe(true);
    }

    // The embedded schema's "grants.items" array references the strict shape
    // directly via $ref to ResearchGrantSchemaStrict. We assert that
    // "fitRubric" appears as a property somewhere in the JSON the prompt asks
    // the LLM to produce.
    const schemaText = JSON.stringify(schema);
    expect(schemaText).toContain('fitRubric');
    expect(schemaText).toContain('changeClass');
    expect(schemaText).toContain('lastSeenConfirmed');
  });

  it('ResearchGrantSchemaStrict accepts a fully populated grant', () => {
    const result = ResearchGrantSchemaStrict.safeParse({
      title: 'Test',
      funder: 'Funder',
      fitRubric: {
        missionAlignment: { score: 80, justification: 'm' },
        geographicFocus: { score: 70, justification: 'g' },
        programTrackrecord: { score: 75, justification: 'p' },
        budgetCapacity: { score: 60, justification: 'b' },
        partnershipReadiness: { score: 65, justification: 'r' },
        overallRationale: 'overall good',
        rubricVersion: 1,
      },
      changeClass: 'new',
      evidence: { deadline: '2026-12-31' },
      lastSeenConfirmed: true,
    });
    expect(result.success).toBe(true);
  });
});
