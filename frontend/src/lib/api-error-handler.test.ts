import { describe, expect, it } from 'vitest';
import { type ApiErrorCode, createErrorResponse } from './api-error-handler';

describe('createErrorResponse', () => {
  it('returns the error code and message', () => {
    const result = createErrorResponse('VALIDATION_ERROR', 'Invalid input');
    expect(result.code).toBe('VALIDATION_ERROR');
    expect(result.error).toBe('Invalid input');
  });

  it('omits details when not provided', () => {
    const result = createErrorResponse('INTERNAL_ERROR', 'Something went wrong');
    expect(result.details).toBeUndefined();
  });

  it('includes details when provided', () => {
    const result = createErrorResponse('VALIDATION_ERROR', 'Bad input', {
      field: 'email',
      reason: 'required',
    });
    expect(result.details).toEqual({ field: 'email', reason: 'required' });
  });

  it('handles all known error codes', () => {
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
      'RESET_FAILED',
      'INTERNAL_ERROR',
    ];
    for (const code of codes) {
      const result = createErrorResponse(code, `Error: ${code}`);
      expect(result.code).toBe(code);
      expect(result.error).toBe(`Error: ${code}`);
    }
  });

  it('returns details as empty object when provided explicitly', () => {
    const result = createErrorResponse('INTERNAL_ERROR', 'Oops', {});
    expect(result.details).toEqual({});
  });
});
