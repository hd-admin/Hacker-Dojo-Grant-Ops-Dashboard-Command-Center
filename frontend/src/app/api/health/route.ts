import { NextResponse, connection } from 'next/server';
import { getDependencies } from '@/server/grant-ops/dependencies';
import { getHealth } from '@/server/grant-ops/health-service';
import { ensureProPublicaSourceRegistered } from '@/server/grant-ops/propublica-service';

export const dynamic = 'force-dynamic';

export async function GET() {
	await connection();
	const deps = getDependencies();
	const result = await getHealth(deps);
	try {
		await ensureProPublicaSourceRegistered();
	} catch {
		// Non-blocking: ProPublica registration failure must not break health response
	}
	return NextResponse.json(result);
}
