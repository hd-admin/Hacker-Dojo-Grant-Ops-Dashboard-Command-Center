import { NextRequest, NextResponse } from 'next/server';
import { getDependencies } from '@/server/grant-ops/dependencies';
export const dynamic = 'force-dynamic';


export async function GET() {
  try {
    const deps = getDependencies();
    const profile = await deps.repository.getOrgProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }
    return NextResponse.json(profile);
  } catch (error) {
    console.error('Error getting profile:', error);
    return NextResponse.json({ error: 'Failed to get profile' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const deps = getDependencies();
    await deps.repository.updateOrgProfile(body);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
