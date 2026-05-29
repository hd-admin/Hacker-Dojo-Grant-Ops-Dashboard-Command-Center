export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    return Response.json({ success: true, locked: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}
