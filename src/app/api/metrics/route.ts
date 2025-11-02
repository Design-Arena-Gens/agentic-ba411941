import { NextResponse } from 'next/server';
import { calculateMetrics, getConflicts, getTransactions, primeDemoData } from '@/lib/store';

export function GET() {
  primeDemoData();
  const metrics = calculateMetrics();
  const recentTransactions = getTransactions(10);
  const conflictSummary = getConflicts()
    .filter((conflict) => conflict.state === 'open')
    .slice(0, 5);

  return NextResponse.json({
    metrics,
    recentTransactions,
    conflicts: conflictSummary,
  });
}
