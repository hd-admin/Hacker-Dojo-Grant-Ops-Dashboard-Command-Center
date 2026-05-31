import { z } from 'zod';
import { createErrorResponse } from './api-error-handler';
import type { ApiErrorCode, ApiErrorResponse } from './api-error-handler';
import { NextResponse } from 'next/server';

export { createErrorResponse };
export type { ApiErrorCode, ApiErrorResponse };

export function withZodValidation<T>(
  schema: z.ZodType<T>,
  data: unknown,
): { success: true; data: T } | { success: false; response: NextResponse<ApiErrorResponse> } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    return {
      success: false,
      response: NextResponse.json(
        createErrorResponse('VALIDATION_ERROR', 'Request validation failed', {
          issues,
        }),
        { status: 400 },
      ),
    };
  }
  return { success: true, data: result.data };
}

export function withErrorHandler<T>(
  fn: () => Promise<NextResponse<T>>,
): Promise<NextResponse<T | ApiErrorResponse>> {
  return fn().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    const code = determineErrorCode(err);
    return NextResponse.json(createErrorResponse(code, message), {
      status: errorCodeToHttpStatus(code),
    });
  });
}

function determineErrorCode(err: unknown): ApiErrorCode {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes('not found') || msg.includes('no such')) return 'FILE_NOT_FOUND';
    if (msg.includes('too large') || msg.includes('size')) return 'FILE_TOO_LARGE';
    if (msg.includes('unsupported') || msg.includes('type')) return 'FILE_UNSUPPORTED_TYPE';
    if (msg.includes('validation') || msg.includes('schema')) return 'VALIDATION_ERROR';
    if (msg.includes('timeout') || msg.includes('timed out')) return 'AGENT_TIMEOUT';
    if (msg.includes('integrity') || msg.includes('corrupt')) return 'DB_INTEGRITY_ERROR';
    if (msg.includes('locked') || msg.includes('busy')) return 'DB_LOCKED';
    if (msg.includes('unavailable') || msg.includes('storage')) return 'STORAGE_UNAVAILABLE';
    if (msg.includes('state transition') || msg.includes('invalid state')) return 'INVALID_STATE_TRANSITION';
    if (msg.includes('submission blocked') || msg.includes('blocked')) return 'SUBMISSION_BLOCKED';
    if (msg.includes('operator') || msg.includes('name required')) return 'OPERATOR_NAME_REQUIRED';
    if (msg.includes('quality') || msg.includes('failed')) return 'AGENT_QUALITY_FAILED';
    if (msg.includes('artifact') && msg.includes('not found')) return 'AGENT_ARTIFACT_NOT_FOUND';
    if (msg.includes('json') || msg.includes('parse')) return 'AGENT_INVALID_JSON';
    if (msg.includes('schema') || msg.includes('mismatch')) return 'AGENT_SCHEMA_MISMATCH';
    if (msg.includes('retries') || msg.includes('retry')) return 'AGENT_MAX_RETRIES';
  }
  return 'INTERNAL_ERROR';
}

function errorCodeToHttpStatus(code: ApiErrorCode): number {
  switch (code) {
    case 'VALIDATION_ERROR':
    case 'UPLOAD_VALIDATION_FAILED':
      return 400;
    case 'OPERATOR_NAME_REQUIRED':
      return 403;
    case 'FILE_NOT_FOUND':
      return 404;
    case 'INVALID_STATE_TRANSITION':
    case 'SUBMISSION_BLOCKED':
      return 409;
    case 'FILE_TOO_LARGE':
    case 'FILE_UNSUPPORTED_TYPE':
      return 413;
    case 'AGENT_TIMEOUT':
      return 504;
    case 'DB_INTEGRITY_ERROR':
    case 'DB_LOCKED':
    case 'STORAGE_UNAVAILABLE':
    case 'AGENT_ARTIFACT_NOT_FOUND':
    case 'AGENT_INVALID_JSON':
    case 'AGENT_SCHEMA_MISMATCH':
    case 'AGENT_MAX_RETRIES':
    case 'AGENT_QUALITY_FAILED':
    case 'INTERNAL_ERROR':
      return 500;
  }
}

export const jsonOk = <T>(data: T, status = 200): NextResponse<T> =>
  NextResponse.json(data, { status });

export const jsonCreated = <T>(data: T): NextResponse<T> =>
  NextResponse.json(data, { status: 201 });

export const jsonNoContent = (): NextResponse<null> =>
  new NextResponse(null, { status: 204 });
