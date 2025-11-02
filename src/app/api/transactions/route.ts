import { NextRequest, NextResponse } from 'next/server';
import { createTransaction, getTransactions, primeDemoData } from '@/lib/store';
import type { Currency, TransactionIntent } from '@/lib/types';

export function GET(request: NextRequest) {
  primeDemoData();
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get('limit') ?? '25');
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 25;
  return NextResponse.json({ transactions: getTransactions(safeLimit) });
}

export async function POST(request: NextRequest) {
  primeDemoData();
  const payload = (await request.json()) as Partial<TransactionIntent>;

  const amount = Number(payload.amount);
  const currency = payload.currency;
  const merchantId = payload.merchantId;
  const reference = payload.reference ?? `ORDER-${Math.floor(Math.random() * 100000)}`;
  const channel = payload.channel ?? 'web';
  const riskLevel = payload.riskLevel ?? 'medium';

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'invalid_amount' }, { status: 400 });
  }

  const supportedCurrencies: Currency[] = ['USD', 'EUR', 'GBP', 'JPY', 'AUD'];
  if (!currency || !supportedCurrencies.includes(currency)) {
    return NextResponse.json({ error: 'unsupported_currency' }, { status: 400 });
  }

  if (!merchantId) {
    return NextResponse.json({ error: 'missing_merchant' }, { status: 400 });
  }

  const intent: TransactionIntent = {
    amount,
    currency,
    merchantId,
    reference,
    channel,
    riskLevel,
  };

  const transaction = createTransaction(intent);

  return NextResponse.json({ transaction }, { status: 201 });
}
