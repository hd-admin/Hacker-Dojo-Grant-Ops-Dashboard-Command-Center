import type { NextRequest } from 'next/server';
import { logger } from '@/lib/logger';
import { NextResponse, connection } from "next/server";
import { opencodeFailureMessages } from '@/lib/failure-messages';
import { classifyOpencodeError } from '@/server/grant-ops/opencode-client';
import {
  ensureProPublicaSourceRegistered,
  fetchProPublicaGrants,
} from '@/server/grant-ops/propublica-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  await connection();
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'QUERY_REQUIRED', message: 'A search query is required' },
        { status: 400 },
      );
    }

    if (query.length > 500) {
      return NextResponse.json(
        { error: 'QUERY_TOO_LONG', message: 'Search query must be 500 characters or fewer' },
        { status: 400 },
      );
    }

    // Lazily register ProPublica as a source record
    await ensureProPublicaSourceRegistered();

    const result = await fetchProPublicaGrants(query.trim());

    if (result.unavailable) {
      return NextResponse.json(
        {
          grants: [],
          unavailable: true,
          message: 'ProPublica is currently unavailable. Your local data is unaffected.',
        },
        { status: 200 },
      );
    }

    if (result.error) {
      const failureMode = classifyOpencodeError(result.error);
      const guidance = opencodeFailureMessages[failureMode];
      return NextResponse.json(
        {
          grants: [],
          error: result.error,
          failureMode,
          guidance,
        },
        { status: 200 },
      );
    }

    return NextResponse.json({ grants: result.grants });
  } catch (_error) {
    logger.error({ err: error }, 'Error in ProPublica search');
    const errorMessage = error instanceof Error ? error.message : 'Failed to search ProPublica';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 },
    );
  }
}
