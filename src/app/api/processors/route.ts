import { NextResponse } from 'next/server';
import { getProcessors, primeDemoData } from '@/lib/store';

export function GET() {
  primeDemoData();
  return NextResponse.json({ processors: getProcessors() });
}
