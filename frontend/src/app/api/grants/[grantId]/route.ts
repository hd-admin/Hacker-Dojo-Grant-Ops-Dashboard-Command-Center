import { NextRequest, NextResponse } from 'next/server';
import { getDependencies } from '@/server/grant-ops/dependencies';
export const dynamic = 'force-dynamic';


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ grantId: string }> },
) {
  try {
    const { grantId } = await params;
    const deps = getDependencies();
    const grant = await deps.repository.getGrant(grantId);

    if (!grant) {
      return NextResponse.json({ error: 'Grant not found' }, { status: 404 });
    }

    return NextResponse.json(grant);
  } catch (error) {
    console.error('Error getting grant:', error);
    return NextResponse.json({ error: 'Failed to get grant' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ grantId: string }> },
) {
  try {
    const { grantId } = await params;
    const body = await request.json();
    const deps = getDependencies();

    await deps.repository.updateGrant(grantId, body);

    const updatedGrant = await deps.repository.getGrant(grantId);
    return NextResponse.json(updatedGrant);
  } catch (error) {
    console.error('Error updating grant:', error);
    return NextResponse.json({ error: 'Failed to update grant' }, { status: 500 });
  }
}
