import { NextResponse } from 'next/server';
import { getDependencies } from '@/server/grant-ops/dependencies';
import { getHealth } from '@/server/grant-ops/health-service';

export const dynamic = 'force-dynamic';

export async function GET() {
	const deps = getDependencies();
	const result = await getHealth(deps);
	return NextResponse.json(result);
}
