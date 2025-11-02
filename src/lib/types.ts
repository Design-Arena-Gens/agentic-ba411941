export type Currency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'AUD';

export type Merchant = {
  id: string;
  name: string;
  vertical: 'ecommerce' | 'saas' | 'marketplace';
  tier: 'standard' | 'enterprise';
  monthlyVolume: number;
  active: boolean;
  preferredCurrencies: Currency[];
};

export type ProcessorStatus = 'online' | 'degraded' | 'offline';

export type Processor = {
  id: string;
  name: string;
  regions: string[];
  currencies: Currency[];
  baseFee: number;
  successRate: number;
  maxAmount: number;
  latencyScore: number;
  priority: number;
  status: ProcessorStatus;
  specialization?: 'high_risk' | 'low_risk' | 'wallets';
};

export type TransactionIntent = {
  amount: number;
  currency: Currency;
  merchantId: string;
  reference: string;
  channel: 'web' | 'mobile' | 'pos';
  riskLevel: 'low' | 'medium' | 'high';
};

export type TransactionState = 'success' | 'failed' | 'pending' | 'conflict';

export type Transaction = {
  id: string;
  intent: TransactionIntent;
  processorId: string | null;
  state: TransactionState;
  createdAt: string;
  settledAt: string | null;
  failureReason?: string;
};

export type Conflict = {
  id: string;
  transactionId: string;
  merchantId: string;
  currency: Currency;
  amount: number;
  reason: string;
  suggestedProcessorIds: string[];
  createdAt: string;
  state: 'open' | 'resolved';
  resolutionNote?: string;
  resolvedAt?: string;
};

export type SmartRouteCandidate = {
  processor: Processor;
  score: number;
  reasons: string[];
};

export type SmartRouteDecision =
  | {
      status: 'success';
      processor: Processor;
      scorecard: SmartRouteCandidate[];
      attempts: { processorId: string; outcome: 'success' | 'failure'; reason?: string }[];
    }
  | {
      status: 'conflict';
      scorecard: SmartRouteCandidate[];
      reason: string;
    };
