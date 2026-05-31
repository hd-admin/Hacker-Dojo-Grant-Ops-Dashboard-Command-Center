export type ApiErrorCode =
  | 'AGENT_ARTIFACT_NOT_FOUND'
  | 'AGENT_INVALID_JSON'
  | 'AGENT_SCHEMA_MISMATCH'
  | 'AGENT_TIMEOUT'
  | 'AGENT_MAX_RETRIES'
  | 'AGENT_QUALITY_FAILED'
  | 'DB_INTEGRITY_ERROR'
  | 'DB_LOCKED'
  | 'FILE_NOT_FOUND'
  | 'FILE_TOO_LARGE'
  | 'FILE_UNSUPPORTED_TYPE'
  | 'UPLOAD_VALIDATION_FAILED'
  | 'INVALID_STATE_TRANSITION'
  | 'SUBMISSION_BLOCKED'
  | 'STORAGE_UNAVAILABLE'
  | 'OPERATOR_NAME_REQUIRED'
  | 'VALIDATION_ERROR';

export interface ApiErrorResponse {
  error: string;
  code: ApiErrorCode;
  details?: Record<string, unknown>;
}

export function createErrorResponse(
  code: ApiErrorCode,
  message: string,
  details?: Record<string, unknown>,
): ApiErrorResponse {
  const response: ApiErrorResponse = { error: message, code };
  if (details !== undefined) {
    response.details = details;
  }
  return response;
}
