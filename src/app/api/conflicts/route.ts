import { NextRequest, NextResponse } from 'next/server';
import { getConflicts, primeDemoData, resolveConflict } from '@/lib/store';

export function GET() {
  primeDemoData();
  return NextResponse.json({ conflicts: getConflicts() });
}

export async function PATCH(request: NextRequest) {
  primeDemoData();
  const body = await request.json();
  const { conflictId, note } = body as { conflictId?: string; note?: string };

  if (!conflictId) {
    return NextResponse.json({ error: 'missing_conflict_id' }, { status: 400 });
  }

  const updated = resolveConflict(conflictId, note ?? 'manual-resolution');
  if (!updated) {
    return NextResponse.json({ error: 'conflict_not_found' }, { status: 404 });
  }

  return NextResponse.json({ conflict: updated });
}
