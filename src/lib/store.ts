import { randomUUID } from 'crypto';
import type {
  Conflict,
  Currency,
  Merchant,
  Processor,
  SmartRouteDecision,
  SmartRouteCandidate,
  Transaction,
  TransactionIntent,
} from './types';

const merchants: Merchant[] = [
  {
    id: 'mrc_aegis',
    name: 'Aegis Outfitters',
    vertical: 'ecommerce',
    tier: 'enterprise',
    monthlyVolume: 180000,
    active: true,
    preferredCurrencies: ['USD', 'GBP', 'EUR'],
  },
  {
    id: 'mrc_aurora',
    name: 'Aurora SaaS',
    vertical: 'saas',
    tier: 'standard',
    monthlyVolume: 85000,
    active: true,
    preferredCurrencies: ['USD', 'EUR'],
  },
  {
    id: 'mrc_omni',
    name: 'Omni Collective',
    vertical: 'marketplace',
    tier: 'enterprise',
    monthlyVolume: 420000,
    active: true,
    preferredCurrencies: ['USD', 'EUR', 'GBP', 'JPY'],
  },
];

const processors: Processor[] = [
  {
    id: 'psr_stablepay',
    name: 'StablePay Core',
    regions: ['na', 'eu'],
    currencies: ['USD', 'EUR', 'GBP'],
    baseFee: 0.018,
    successRate: 0.989,
    maxAmount: 50000,
    latencyScore: 0.9,
    priority: 10,
    status: 'online',
  },
  {
    id: 'psr_flashwave',
    name: 'FlashWave Realtime',
    regions: ['na', 'apac'],
    currencies: ['USD', 'JPY', 'AUD'],
    baseFee: 0.021,
    successRate: 0.978,
    maxAmount: 75000,
    latencyScore: 0.96,
    priority: 8,
    status: 'online',
    specialization: 'wallets',
  },
  {
    id: 'psr_guardian',
    name: 'Guardian Shield',
    regions: ['eu'],
    currencies: ['EUR', 'GBP'],
    baseFee: 0.023,
    successRate: 0.993,
    maxAmount: 40000,
    latencyScore: 0.82,
    priority: 9,
    status: 'degraded',
    specialization: 'high_risk',
  },
  {
    id: 'psr_nimbus',
    name: 'Nimbus Edge',
    regions: ['global'],
    currencies: ['USD', 'EUR', 'GBP', 'JPY', 'AUD'],
    baseFee: 0.026,
    successRate: 0.965,
    maxAmount: 120000,
    latencyScore: 0.74,
    priority: 7,
    status: 'online',
  },
  {
    id: 'psr_reserve',
    name: 'ReserveFallBack',
    regions: ['na', 'eu'],
    currencies: ['USD', 'EUR'],
    baseFee: 0.032,
    successRate: 0.941,
    maxAmount: 30000,
    latencyScore: 0.68,
    priority: 5,
    status: 'online',
  },
];

const transactions: Transaction[] = [];
const conflicts: Conflict[] = [];

const currencyToRegion: Record<Currency, string[]> = {
  USD: ['na', 'global'],
  EUR: ['eu', 'global'],
  GBP: ['eu', 'global'],
  JPY: ['apac', 'global'],
  AUD: ['apac', 'global'],
};

const riskWeight: Record<'low' | 'medium' | 'high', number> = {
  low: 1,
  medium: 0.85,
  high: 0.7,
};

const specializationAffinity: Record<string, Record<'low' | 'medium' | 'high', number>> = {
  high_risk: { low: 0.6, medium: 0.85, high: 1.1 },
  low_risk: { low: 1.1, medium: 1, high: 0.8 },
  wallets: { low: 1, medium: 0.95, high: 0.9 },
};

function buildScorecard(intent: TransactionIntent): SmartRouteCandidate[] {
  const regionHints = currencyToRegion[intent.currency] ?? ['global'];

  const candidates = processors
    .filter((processor) => processor.status !== 'offline')
    .filter((processor) => processor.currencies.includes(intent.currency))
    .filter((processor) => intent.amount <= processor.maxAmount * 1.05);

  return candidates.map((processor) => {
    const reasons: string[] = [];

    if (processor.status === 'degraded') {
      reasons.push('status:degraded');
    } else {
      reasons.push('status:online');
    }

    if (regionHints.some((region) => processor.regions.includes(region))) {
      reasons.push('region:matched');
    } else {
      reasons.push('region:partial');
    }

    const affinity = processor.specialization
      ? specializationAffinity[processor.specialization]?.[intent.riskLevel] ?? 0.95
      : 1;

    if (processor.specialization) {
      reasons.push(`specialization:${processor.specialization}`);
    }

    const successBoost = processor.successRate * 1.4;
    const latencyBoost = processor.latencyScore * 0.6;
    const priorityBoost = processor.priority * 0.05;
    const riskMod = riskWeight[intent.riskLevel];
    const feePenalty = (1 / Math.max(processor.baseFee, 0.01)) * 0.12;

    const statusWeight = processor.status === 'degraded' ? 0.75 : 1;

    const score =
      (successBoost + latencyBoost + priorityBoost + feePenalty) *
      riskMod *
      affinity *
      statusWeight;

    return { processor, score, reasons };
  });
}

function simulateProcessorAttempt(
  processorId: string,
  intent: TransactionIntent,
): { outcome: 'success' | 'failure'; reason?: string } {
  const processor = processors.find((item) => item.id === processorId);
  if (!processor) {
    return { outcome: 'failure', reason: 'processor-not-found' };
  }

  const baseSuccess = processor.successRate;
  const riskPenalty = intent.riskLevel === 'high' ? 0.08 : intent.riskLevel === 'medium' ? 0.03 : 0;
  const statusPenalty = processor.status === 'degraded' ? 0.07 : 0;
  const amountPenalty = intent.amount > processor.maxAmount * 0.9 ? 0.1 : 0;
  const successThreshold = baseSuccess - riskPenalty - statusPenalty - amountPenalty;

  const roll = Math.random();
  if (roll <= successThreshold) {
    return { outcome: 'success' };
  }
  const reason =
    roll > successThreshold + 0.2
      ? 'processor-timeout'
      : amountPenalty > 0
      ? 'amount-over-threshold'
      : riskPenalty > 0
      ? 'risk-decline'
      : 'network-error';
  return { outcome: 'failure', reason };
}

export function getMerchants(): Merchant[] {
  return merchants;
}

export function getProcessors(): Processor[] {
  return processors;
}

export function getTransactions(limit = 50): Transaction[] {
  return transactions.slice(-limit).reverse();
}

export function getConflicts(): Conflict[] {
  return conflicts.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function resolveConflict(conflictId: string, note: string): Conflict | null {
  const conflict = conflicts.find((item) => item.id === conflictId && item.state === 'open');
  if (!conflict) {
    return null;
  }
  conflict.state = 'resolved';
  conflict.resolvedAt = new Date().toISOString();
  conflict.resolutionNote = note;
  const txn = transactions.find((item) => item.id === conflict.transactionId);
  if (txn && txn.state === 'conflict') {
    txn.state = 'failed';
    txn.failureReason = note || 'manually-resolved';
  }
  return conflict;
}

export function calculateMetrics() {
  const totalVolume = transactions.reduce((sum, txn) => {
    if (txn.state === 'success') {
      return sum + txn.intent.amount;
    }
    return sum;
  }, 0);

  const successCount = transactions.filter((txn) => txn.state === 'success').length;
  const failureCount = transactions.filter((txn) => txn.state === 'failed').length;
  const conflictCount = conflicts.filter((conflict) => conflict.state === 'open').length;

  const successRate =
    transactions.length === 0
      ? 0
      : Math.round((successCount / transactions.length) * 1000) / 10;

  const avgTicket =
    successCount === 0
      ? 0
      : Math.round((totalVolume / successCount + Number.EPSILON) * 100) / 100;

  return {
    totalVolume,
    successRate,
    failureCount,
    conflictCount,
    avgTicket,
    transactionCount: transactions.length,
  };
}

export function computeSmartRoute(
  intent: TransactionIntent,
  allowDegradedFallback = true,
): SmartRouteDecision {
  const scorecard = buildScorecard(intent).sort((a, b) => b.score - a.score);

  if (scorecard.length === 0) {
    return {
      status: 'conflict',
      scorecard,
      reason: 'no-eligible-processors',
    };
  }

  const attemptLog: { processorId: string; outcome: 'success' | 'failure'; reason?: string }[] = [];
  const primaryCandidates = scorecard.filter((item) => item.processor.status === 'online');
  const fallbackCandidates = allowDegradedFallback
    ? scorecard.filter((item) => item.processor.status === 'degraded')
    : [];
  const ordered = [...primaryCandidates, ...fallbackCandidates];

  for (const candidate of ordered) {
    const result = simulateProcessorAttempt(candidate.processor.id, intent);
    attemptLog.push({ processorId: candidate.processor.id, ...result });
    if (result.outcome === 'success') {
      return {
        status: 'success',
        processor: candidate.processor,
        scorecard,
        attempts: attemptLog,
      };
    }
  }

  const reason =
    attemptLog.at(-1)?.reason ?? 'all-processors-declined';

  return {
    status: 'conflict',
    scorecard,
    reason,
  };
}

export function createTransaction(intent: TransactionIntent): Transaction {
  const decision = computeSmartRoute(intent);
  const id = randomUUID();
  const createdAt = new Date().toISOString();

  if (decision.status === 'success') {
    const txn: Transaction = {
      id,
      intent,
      processorId: decision.processor.id,
      state: 'success',
      createdAt,
      settledAt: new Date(Date.now() + 1000 * 60 * 5).toISOString(),
    };
    transactions.push(txn);
    return txn;
  }

  const txn: Transaction = {
    id,
    intent,
    processorId: null,
    state: 'conflict',
    createdAt,
    settledAt: null,
    failureReason: decision.reason,
  };

  transactions.push(txn);

  const conflict: Conflict = {
    id: randomUUID(),
    transactionId: txn.id,
    merchantId: intent.merchantId,
    amount: intent.amount,
    currency: intent.currency,
    reason: decision.reason,
    suggestedProcessorIds: decision.scorecard.slice(0, 3).map((item) => item.processor.id),
    createdAt,
    state: 'open',
  };

  conflicts.push(conflict);

  return txn;
}

export function primeDemoData() {
  if (transactions.length > 0) return;
  const demoIntents: TransactionIntent[] = [
    {
      amount: 482.2,
      currency: 'USD',
      merchantId: 'mrc_aegis',
      reference: 'ORDER-100312',
      channel: 'web',
      riskLevel: 'medium',
    },
    {
      amount: 2199,
      currency: 'EUR',
      merchantId: 'mrc_omni',
      reference: 'ORDER-100441',
      channel: 'mobile',
      riskLevel: 'low',
    },
    {
      amount: 988,
      currency: 'GBP',
      merchantId: 'mrc_aegis',
      reference: 'ORDER-100466',
      channel: 'web',
      riskLevel: 'high',
    },
    {
      amount: 129,
      currency: 'USD',
      merchantId: 'mrc_aurora',
      reference: 'ORDER-200112',
      channel: 'web',
      riskLevel: 'low',
    },
  ];

  demoIntents.forEach((intent) => {
    createTransaction(intent);
  });
}
