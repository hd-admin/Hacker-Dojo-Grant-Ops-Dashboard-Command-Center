import { describe, expect, it } from 'vitest';
import { testFixtureGrants, propublicaSourceFixture, testProfile } from './test-fixtures';

describe('test-fixtures', () => {
  it('has 13 grants', () => { expect(testFixtureGrants).toHaveLength(13); });

  it('dell-equality has correct title and is only Corporate grant', () => {
    const dell = testFixtureGrants.find(g => g.id === 'dell-equality');
    expect(dell?.title).toBe('Dell Technologies Equality Fund');
    const corporate = testFixtureGrants.filter(g => g.tags.includes('Corporate'));
    expect(corporate).toHaveLength(1);
    expect(corporate[0]?.id).toBe('dell-equality');
  });

  it('fit scores sort correctly descending', () => {
    const sorted = [...testFixtureGrants].sort((a, b) => b.fit - a.fit);
    expect(sorted[0]?.funderShort).toBe('NSF');
    expect(sorted[12]?.funderShort).toBe('DEA');
  });

  it('deadline sort puts soonest first and Rolling last', () => {
    const sorted = [...testFixtureGrants].sort((a, b) =>
      a.deadline === 'Rolling' ? 1 : b.deadline === 'Rolling' ? -1 : a.daysOut - b.daysOut
    );
    expect(sorted[0]?.funderShort).toBe('DEA');
    expect(sorted[12]?.funderShort).toBe('SVCF');
  });

  it('award sort puts highest first', () => {
    const sorted = [...testFixtureGrants].sort((a, b) => b.awardSort - a.awardSort);
    expect(sorted[0]?.funderShort).toBe('NSF');
    expect(sorted[12]?.funderShort).toBe('DEA');
  });

  it('propublicaSourceFixture is a system source with correct name', () => {
    expect(propublicaSourceFixture.suggestedBy).toBe('system');
    expect(propublicaSourceFixture.name).toBe('ProPublica Nonprofit Explorer');
    expect(propublicaSourceFixture.reviewStatus).toBe('approved');
    expect(propublicaSourceFixture.url).toBe('https://projects.propublica.org/nonprofits/');
  });

  it('testProfile has correct notifyEmail', () => {
    expect(testProfile.agentBehavior.notifyEmail).toBe('ed@hackerdojo.com');
  });
});
