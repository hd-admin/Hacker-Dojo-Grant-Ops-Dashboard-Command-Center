import { NextRequest, NextResponse } from 'next/server';
import * as repository from '@/server/grant-ops/repository';

export async function GET() {
  try {
    const settings = await repository.getOpencodeSettings();
    if (!settings) {
      return NextResponse.json({ error: 'Opencode settings not found' }, { status: 404 });
    }
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error getting opencode settings:', error);
    return NextResponse.json({ error: 'Failed to get opencode settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    await repository.updateOpencodeSettings(body);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating opencode settings:', error);
    return NextResponse.json({ error: 'Failed to update opencode settings' }, { status: 500 });
  }
}
