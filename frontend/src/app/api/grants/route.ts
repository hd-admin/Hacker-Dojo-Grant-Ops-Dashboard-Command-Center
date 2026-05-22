import { NextResponse } from 'next/server';
import { getDependencies } from '@/server/grant-ops/dependencies';

export async function GET() {
  try {
    const deps = getDependencies();
    const grants = await deps.repository.getGrants();
    return NextResponse.json(grants);
  } catch (error) {
    console.error('Error getting grants:', error);
    return NextResponse.json({ error: 'Failed to get grants' }, { status: 500 });
  }
}
