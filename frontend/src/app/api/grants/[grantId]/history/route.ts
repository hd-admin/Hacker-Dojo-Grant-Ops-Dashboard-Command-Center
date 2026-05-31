import { connection } from 'next/server';
import { NextRequest, NextResponse } from 'next/server';
import { getDependencies } from '@/server/grant-ops/dependencies';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ grantId: string }> }
) {
  await connection();
  try {
    const { grantId } = await params;
    const deps = getDependencies();
    const history = await deps.repository.getPipelineTransitionsByGrantId(grantId);
    return NextResponse.json({
      grantId,
      history,
    });
  } catch (error) {
    console.error('Error getting grant history:', error);
    return NextResponse.json(
      { error: 'Failed to get transition history', code: 'DB_ERROR' },
      { status: 500 },
    );
  }
}
