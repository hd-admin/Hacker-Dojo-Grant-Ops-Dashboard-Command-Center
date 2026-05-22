import { NextResponse } from 'next/server';
import * as repository from '@/server/grant-ops/repository';

export async function GET() {
  try {
    const grants = await repository.getGrants();
    return NextResponse.json(grants);
  } catch (error) {
    console.error('Error getting grants:', error);
    return NextResponse.json({ error: 'Failed to get grants' }, { status: 500 });
  }
}
