import { z } from 'zod';
import { createErrorResponse } from './api-error-handler';
import type { ApiErrorResponse } from './api-error-handler';
import { NextResponse } from 'next/server';

export { createErrorResponse };
export type { ApiErrorResponse };

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


