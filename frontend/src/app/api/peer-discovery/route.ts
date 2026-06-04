import { NextRequest, NextResponse, connection } from 'next/server';
import { createErrorResponse } from '@/lib/api-error-handler';

export const dynamic = 'force-dynamic';

export async function POST(_request: NextRequest) {
  await connection();
  return NextResponse.json(
    createErrorResponse('INTERNAL_ERROR', 'Peer discovery is not yet implemented'),
    { status: 404 },
  );
}
