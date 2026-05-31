import { describe, it, expect } from 'vitest';
import { JobProgress } from './JobProgress';

describe('JobProgress', () => {
  it('exports JobProgress component', () => {
    expect(JobProgress).toBeDefined();
    expect(typeof JobProgress).toBe('function');
  });
});
