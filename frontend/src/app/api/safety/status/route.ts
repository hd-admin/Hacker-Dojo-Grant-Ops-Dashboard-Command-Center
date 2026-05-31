import { connection } from 'next/server';
import { createErrorResponse } from '@/lib/api-error-handler';
import { isPasscodeSet, getLockConfig } from '@/server/grant-ops/safety-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  await connection();
  try {
    const config = getLockConfig();
    const passcodeSet = isPasscodeSet();
    return Response.json({
      isPasscodeSet: passcodeSet,
      lockConfig: config,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return Response.json(
      createErrorResponse('STORAGE_UNAVAILABLE', message),
      { status: 500 }
    );
  }
}
