import { NextRequest, NextResponse } from 'next/server';
import * as repository from '@/server/grant-ops/repository';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ grantId: string }> },
) {
  try {
    const { grantId } = await params;
    const grant = await repository.getGrant(grantId);

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

    await repository.updateGrant(grantId, body);

    const updatedGrant = await repository.getGrant(grantId);
    return NextResponse.json(updatedGrant);
  } catch (error) {
    console.error('Error updating grant:', error);
    return NextResponse.json({ error: 'Failed to update grant' }, { status: 500 });
  }
}
