import { NextRequest, NextResponse } from 'next/server';
import * as sourceService from '@/server/grant-ops/source-service';

export async function GET() {
  try {
    const sources = await sourceService.getAllSources();
    return NextResponse.json(sources);
  } catch (error) {
    console.error('Error getting sources:', error);
    return NextResponse.json({ error: 'Failed to get sources' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.name || !body.url) {
      return NextResponse.json(
        { error: 'Name and URL are required' },
        { status: 400 },
      );
    }

    const source = await sourceService.addSource({
      name: body.name,
      url: body.url,
      type: body.type || 'website',
    });

    return NextResponse.json(source, { status: 201 });
  } catch (error) {
    console.error('Error adding source:', error);
    return NextResponse.json({ error: 'Failed to add source' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Source ID is required' }, { status: 400 });
    }

    await sourceService.removeSource(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing source:', error);
    return NextResponse.json({ error: 'Failed to remove source' }, { status: 500 });
  }
}
