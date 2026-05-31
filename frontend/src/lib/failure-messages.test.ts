/**
 * Failure Messages Tests
 *
 * Verifies all API error codes have user-facing messages per AC-14.10.3.
 */
import { describe, expect, it } from 'vitest';
import { apiErrorMessages, opencodeFailureMessages, jobFailureMessages } from './failure-messages';
import type { ApiErrorCode } from './api-error-handler';

describe('failure-messages', () => {
  it('apiErrorMessages covers all ApiErrorCode values', () => {
    const codes: ApiErrorCode[] = [
      'AGENT_ARTIFACT_NOT_FOUND',
      'AGENT_INVALID_JSON',
      'AGENT_SCHEMA_MISMATCH',
      'AGENT_TIMEOUT',
      'AGENT_MAX_RETRIES',
      'AGENT_QUALITY_FAILED',
      'DB_INTEGRITY_ERROR',
      'DB_LOCKED',
      'FILE_NOT_FOUND',
      'FILE_TOO_LARGE',
      'FILE_UNSUPPORTED_TYPE',
      'UPLOAD_VALIDATION_FAILED',
      'INVALID_STATE_TRANSITION',
      'SUBMISSION_BLOCKED',
      'STORAGE_UNAVAILABLE',
      'OPERATOR_NAME_REQUIRED',
      'VALIDATION_ERROR',
      'INTERNAL_ERROR',
    ];
    for (const code of codes) {
      expect(apiErrorMessages[code]).toBeDefined();
      expect(apiErrorMessages[code]!.title).toBeTruthy();
      expect(apiErrorMessages[code]!.description).toBeTruthy();
      expect(apiErrorMessages[code]!.action).toBeTruthy();
    }
  });

  it('opencodeFailureMessages covers all expected failure modes', () => {
    const modes = Object.keys(opencodeFailureMessages);
    expect(modes.length).toBeGreaterThan(0);
    for (const mode of modes) {
      const msg = opencodeFailureMessages[mode as keyof typeof opencodeFailureMessages];
      expect(msg.title).toBeTruthy();
      expect(msg.description).toBeTruthy();
      expect(msg.action).toBeTruthy();
    }
  });

  it('jobFailureMessages covers all expected categories', () => {
    const categories = Object.keys(jobFailureMessages);
    expect(categories.length).toBeGreaterThan(0);
    for (const category of categories) {
      const msg = jobFailureMessages[category as keyof typeof jobFailureMessages];
      expect(msg.title).toBeTruthy();
      expect(msg.description).toBeTruthy();
      expect(msg.action).toBeTruthy();
    }
  });
});
