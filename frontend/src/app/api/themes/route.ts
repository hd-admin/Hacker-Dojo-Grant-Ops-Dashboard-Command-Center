import { type NextRequest, NextResponse, connection } from "next/server";
import { loadThemesData, saveThemesData } from '../../../../../shared/grant-ops-persistence';
import type { ThemesData } from '../../../../../shared/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_THEMES: ThemesData = {
  keywordClusters: [],
  themes: [],
  regions: [],
  populations: [],
  strategicPriorities: [],
};

export async function GET() {
  await connection();
  try {
    const data = await loadThemesData().catch(() => DEFAULT_THEMES);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(DEFAULT_THEMES);
  }
}

export async function PUT(request: NextRequest) {
  await connection();
  try {
    const body = await request.json().catch(() => null) as ThemesData | null;
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid themes data' }, { status: 400 });
    }
    // Validate matching policy thresholds
    for (const theme of body.themes ?? []) {
      const { matchThreshold, autoDraftThreshold } = theme.matchingPolicy;
      if (matchThreshold < 0 || matchThreshold > 100) {
        return NextResponse.json({ error: 'matchThreshold must be 0-100' }, { status: 400 });
      }
      if (autoDraftThreshold < 0 || autoDraftThreshold > 100) {
        return NextResponse.json({ error: 'autoDraftThreshold must be 0-100' }, { status: 400 });
      }
    }
    await saveThemesData(body);
    const saved = await loadThemesData();
    return NextResponse.json(saved);
  } catch (error) {
    console.error('[themes] PUT failed:', error);
    return NextResponse.json({ error: 'Failed to save themes' }, { status: 500 });
  }
}
