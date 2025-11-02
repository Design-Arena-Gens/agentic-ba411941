import { NextResponse } from 'next/server';
import { getMerchants, primeDemoData } from '@/lib/store';

export function GET() {
  primeDemoData();
  return NextResponse.json({ merchants: getMerchants() });
}
