'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  Conflict,
  Merchant,
  Processor,
  Transaction,
  Currency,
  TransactionIntent,
} from '@/lib/types';

type MetricsResponse = {
  metrics: {
    totalVolume: number;
    successRate: number;
    failureCount: number;
    conflictCount: number;
    avgTicket: number;
    transactionCount: number;
  };
  recentTransactions: Transaction[];
  conflicts: Conflict[];
};

type MerchantsResponse = { merchants: Merchant[] };
type ProcessorsResponse = { processors: Processor[] };
type TransactionsResponse = { transactions: Transaction[] };
type ConflictsResponse = { conflicts: Conflict[] };

type SimulationFormState = {
  merchantId: string;
  amount: string;
  currency: Currency;
  channel: TransactionIntent['channel'];
  riskLevel: TransactionIntent['riskLevel'];
};

const defaultSimulation: SimulationFormState = {
  merchantId: '',
  amount: '',
  currency: 'USD',
  channel: 'web',
  riskLevel: 'medium',
};

const currencySymbols: Record<Currency, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  AUD: 'A$',
};

export function DashboardClient() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [processors, setProcessors] = useState<Processor[]>([]);
  const [metrics, setMetrics] = useState<MetricsResponse['metrics'] | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [simulation, setSimulation] = useState<SimulationFormState>(defaultSimulation);
  const [simulationResult, setSimulationResult] = useState<Transaction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [metricsRes, merchantRes, processorRes, txnRes, conflictRes] = await Promise.all([
        fetch('/api/metrics').then((res) => res.json() as Promise<MetricsResponse>),
        fetch('/api/merchants').then((res) => res.json() as Promise<MerchantsResponse>),
        fetch('/api/processors').then((res) => res.json() as Promise<ProcessorsResponse>),
        fetch('/api/transactions?limit=15').then((res) => res.json() as Promise<TransactionsResponse>),
        fetch('/api/conflicts').then((res) => res.json() as Promise<ConflictsResponse>),
      ]);

      setMetrics(metricsRes.metrics);
      setTransactions(metricsRes.recentTransactions ?? txnRes.transactions);
      setConflicts(conflictRes.conflicts);
      setMerchants(merchantRes.merchants);
      setProcessors(processorRes.processors);
      if (!simulation.merchantId && merchantRes.merchants.length > 0) {
        setSimulation((prev) => ({ ...prev, merchantId: merchantRes.merchants[0].id }));
      }
    } catch (err) {
      console.error(err);
      setError('Unable to load dashboard data. Try refreshing the page.');
    } finally {
      setIsLoading(false);
    }
  }, [simulation.merchantId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSimulate = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);

      if (!simulation.merchantId) {
        setError('Select a merchant to simulate routing.');
        return;
      }

      const amountValue = Number(simulation.amount);
      if (!Number.isFinite(amountValue) || amountValue <= 0) {
        setError('Amount should be a positive number.');
        return;
      }

      setIsSimulating(true);
      try {
        const response = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            merchantId: simulation.merchantId,
            amount: amountValue,
            currency: simulation.currency,
            channel: simulation.channel,
            riskLevel: simulation.riskLevel,
            reference: `SIM-${Date.now()}`,
          }),
        });

        if (!response.ok) {
          const errorPayload = await response.json().catch(() => ({}));
          throw new Error(errorPayload.error ?? 'simulation_failed');
        }

        const payload = (await response.json()) as { transaction: Transaction };
        setSimulationResult(payload.transaction);
        setSimulation((prev) => ({
          ...defaultSimulation,
          merchantId: prev.merchantId || merchants[0]?.id || '',
        }));
        void loadData();
      } catch (err) {
        console.error(err);
        setError('Simulation failed. Inspect inputs or retry in a moment.');
      } finally {
        setIsSimulating(false);
      }
    },
    [simulation, loadData, merchants],
  );

  const handleConflictResolution = useCallback(
    async (conflictId: string) => {
      try {
        const response = await fetch('/api/conflicts', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conflictId,
            note: 'Reviewed and re-routed manually',
          }),
        });

        if (!response.ok) {
          throw new Error('resolution_failed');
        }
        const payload = (await response.json()) as { conflict: Conflict };
        setConflicts((prev) =>
          prev.map((conflict) => (conflict.id === conflictId ? payload.conflict : conflict)),
        );
      } catch (err) {
        console.error(err);
        setError('Conflict resolution failed. Please retry.');
      }
    },
    [],
  );

  const merchantMap = useMemo(() => {
    return merchants.reduce<Record<string, Merchant>>((acc, merchant) => {
      acc[merchant.id] = merchant;
      return acc;
    }, {});
  }, [merchants]);

  const processorMap = useMemo(() => {
    return processors.reduce<Record<string, Processor>>((acc, processor) => {
      acc[processor.id] = processor;
      return acc;
    }, {});
  }, [processors]);

  const healthSummary = useMemo(() => {
    if (processors.length === 0) return 'No processors';
    const online = processors.filter((processor) => processor.status === 'online').length;
    const degraded = processors.filter((processor) => processor.status === 'degraded').length;

    if (degraded === 0) {
      return `${online} processors fully operational`;
    }
    return `${online} online / ${degraded} degraded processors`;
  }, [processors]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-white/10 bg-slate-950/70 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-widest text-sky-400">AegisPay Control</p>
            <h1 className="mt-2 text-3xl font-semibold text-white md:text-4xl">Smart Routing Hub</h1>
            <p className="mt-2 max-w-xl text-sm text-slate-300">
              Multi-processor orchestration, live routing decisions, and conflict management for
              high-velocity payment teams.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900 px-5 py-4 text-sm text-slate-300 shadow-xl">
            <p className="text-xs uppercase tracking-wide text-slate-400">Processor Health</p>
            <p className="mt-1 text-lg font-medium text-white">{healthSummary}</p>
            <p className="mt-2 text-xs text-slate-400">
              Updated {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-10">
        {error ? (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <section>
          <h2 className="text-xl font-medium text-white">Operational Lens</h2>
          <p className="mt-1 text-sm text-slate-300">
            Track realtime performance across the multi-processor mesh.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              isLoading={isLoading}
              label="Processed Volume"
              value={
                metrics
                  ? `${currencySymbols.USD}${metrics.totalVolume.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}`
                  : ''
              }
              trend={metrics ? `${metrics.transactionCount} transactions` : ''}
            />
            <MetricCard
              isLoading={isLoading}
              label="Success Rate"
              value={metrics ? `${metrics.successRate.toFixed(1)}%` : ''}
              trend={
                metrics
                  ? `${metrics.failureCount} failures · ${metrics.conflictCount} conflicts`
                  : ''
              }
            />
            <MetricCard
              isLoading={isLoading}
              label="Average Ticket"
              value={metrics ? `${currencySymbols.USD}${metrics.avgTicket.toFixed(2)}` : ''}
              trend={merchants.length ? `${merchants.length} active merchants` : ''}
            />
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-medium text-white">Transaction Stream</h2>
              <button
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-slate-200 transition hover:border-white/30 hover:bg-white/10"
                onClick={() => void loadData()}
              >
                Refresh
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-300">
              Recent routing outcomes with processor attribution and statuses.
            </p>
            <TransactionTable
              isLoading={isLoading}
              transactions={transactions}
              merchantMap={merchantMap}
              processorMap={processorMap}
            />
          </div>
          <div className="flex flex-col gap-6">
            <SimulationPanel
              simulation={simulation}
              setSimulation={setSimulation}
              merchants={merchants}
              onSubmit={handleSimulate}
              isSimulating={isSimulating}
            />
            <RoutingInsightCard result={simulationResult} processorMap={processorMap} />
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-2">
          <ConflictDesk
            conflicts={conflicts}
            onResolve={handleConflictResolution}
            processorMap={processorMap}
            merchantMap={merchantMap}
            isLoading={isLoading}
          />
          <ProcessorMatrix processors={processors} />
        </section>
      </main>
      <footer className="border-t border-white/10 bg-slate-950/80 py-8 text-center text-xs text-slate-500">
        AegisPay · Adaptive payment routing layer for resilient commerce.
      </footer>
    </div>
  );
}

function MetricCard({
  label,
  value,
  trend,
  isLoading,
}: {
  label: string;
  value: string;
  trend: string;
  isLoading: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/70 px-5 py-6 shadow-xl">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      {isLoading ? (
        <div className="mt-4 h-8 animate-pulse rounded bg-white/10" />
      ) : (
        <p className="mt-4 text-3xl font-semibold text-white">{value}</p>
      )}
      <p className="mt-2 text-xs text-slate-400">{trend}</p>
    </div>
  );
}

function TransactionTable({
  transactions,
  merchantMap,
  processorMap,
  isLoading,
}: {
  transactions: Transaction[];
  merchantMap: Record<string, Merchant>;
  processorMap: Record<string, Processor>;
  isLoading: boolean;
}) {
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70 shadow-xl">
      <table className="min-w-full divide-y divide-white/10 text-sm">
        <thead className="bg-white/5 uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-4 py-3 text-left">Merchant</th>
            <th className="px-4 py-3 text-left">Amount</th>
            <th className="px-4 py-3 text-left">Processor</th>
            <th className="px-4 py-3 text-left">State</th>
            <th className="px-4 py-3 text-left">Ref</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5 text-slate-200">
          {isLoading ? (
            <tr>
              <td colSpan={5} className="px-4 py-6">
                <div className="h-6 animate-pulse rounded bg-white/10" />
              </td>
            </tr>
          ) : transactions.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                No transactions yet. Run a simulation to populate the stream.
              </td>
            </tr>
          ) : (
            transactions.map((transaction) => {
              const merchant = merchantMap[transaction.intent.merchantId];
              const processor =
                transaction.processorId && processorMap[transaction.processorId];
              const symbol = currencySymbols[transaction.intent.currency];
              return (
                <tr key={transaction.id} className="transition hover:bg-white/5">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">
                      {merchant?.name ?? transaction.intent.merchantId}
                    </div>
                    <div className="text-xs uppercase text-slate-400">
                      {transaction.intent.channel} · {transaction.intent.riskLevel} risk
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-white">
                    {symbol}
                    {transaction.intent.amount.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {processor ? (
                      <span>
                        {processor.name}
                        <span className="block text-xs text-slate-400">
                          {processor.status === 'online' ? 'primary route' : 'fallback path'}
                        </span>
                      </span>
                    ) : (
                      <span className="text-xs uppercase text-amber-300">
                        Awaiting reroute · {transaction.failureReason}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge state={transaction.state} />
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">{transaction.intent.reference}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ state }: { state: Transaction['state'] }) {
  if (state === 'success') {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300">
        Success
      </span>
    );
  }
  if (state === 'conflict') {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-200">
        Conflict
      </span>
    );
  }
  if (state === 'pending') {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-500/15 px-2.5 py-1 text-xs font-semibold text-slate-200">
        Pending
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-rose-500/15 px-2.5 py-1 text-xs font-semibold text-rose-200">
      Failed
    </span>
  );
}

function SimulationPanel({
  simulation,
  setSimulation,
  merchants,
  onSubmit,
  isSimulating,
}: {
  simulation: SimulationFormState;
  setSimulation: React.Dispatch<React.SetStateAction<SimulationFormState>>;
  merchants: Merchant[];
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  isSimulating: boolean;
}) {
  return (
    <div className="rounded-2xl border border-sky-500/30 bg-slate-900/80 p-6 shadow-xl">
      <h3 className="text-lg font-semibold text-white">Simulate Smart Route</h3>
      <p className="mt-1 text-xs text-slate-400">
        Generate a clean-room transaction to test processor selection.
      </p>
      <form className="mt-4 space-y-4 text-sm text-slate-200" onSubmit={onSubmit}>
        <label className="block text-xs uppercase text-slate-400">
          Merchant
          <select
            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-500"
            value={simulation.merchantId}
            onChange={(event) =>
              setSimulation((prev) => ({ ...prev, merchantId: event.target.value }))
            }
          >
            <option value="">Select merchant</option>
            {merchants.map((merchant) => (
              <option key={merchant.id} value={merchant.id}>
                {merchant.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs uppercase text-slate-400">
          Amount
          <input
            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-500"
            type="number"
            step="0.01"
            placeholder="250.00"
            value={simulation.amount}
            onChange={(event) =>
              setSimulation((prev) => ({ ...prev, amount: event.target.value }))
            }
          />
        </label>
        <label className="block text-xs uppercase text-slate-400">
          Currency
          <select
            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-500"
            value={simulation.currency}
            onChange={(event) =>
              setSimulation((prev) => ({
                ...prev,
                currency: event.target.value as Currency,
              }))
            }
          >
            {Object.keys(currencySymbols).map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs uppercase text-slate-400">
            Channel
            <select
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-500"
              value={simulation.channel}
              onChange={(event) =>
                setSimulation((prev) => ({
                  ...prev,
                  channel: event.target.value as SimulationFormState['channel'],
                }))
              }
            >
              <option value="web">Web</option>
              <option value="mobile">Mobile</option>
              <option value="pos">Point of Sale</option>
            </select>
          </label>
          <label className="block text-xs uppercase text-slate-400">
            Risk Level
            <select
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-500"
              value={simulation.riskLevel}
              onChange={(event) =>
                setSimulation((prev) => ({
                  ...prev,
                  riskLevel: event.target.value as SimulationFormState['riskLevel'],
                }))
              }
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
        </div>

        <button
          type="submit"
          className="w-full rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSimulating}
        >
          {isSimulating ? 'Routing...' : 'Simulate Route'}
        </button>
      </form>
    </div>
  );
}

function RoutingInsightCard({
  result,
  processorMap,
}: {
  result: Transaction | null;
  processorMap: Record<string, Processor>;
}) {
  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-6 text-sm text-emerald-100 shadow-xl">
      <h3 className="text-lg font-semibold text-emerald-100">Routing Insight</h3>
      {result ? (
        <div className="mt-3 space-y-3 text-xs leading-relaxed text-emerald-50/90">
          <div className="flex items-center justify-between text-sm font-semibold">
            <span>Outcome</span>
            <StatusBadge state={result.state} />
          </div>
          <p>
            {result.state === 'success' ? (
              <>
                Routed to{' '}
                <span className="font-semibold">
                  {result.processorId ? processorMap[result.processorId]?.name : 'fallback queue'}
                </span>{' '}
                for {currencySymbols[result.intent.currency]}
                {result.intent.amount.toFixed(2)} under {result.intent.riskLevel} risk posture.
              </>
            ) : (
              <>
                Transaction escalated for manual handling. Root cause:{' '}
                <span className="font-semibold uppercase">{result.failureReason ?? 'unknown'}</span>
              </>
            )}
          </p>
          <p className="text-[11px] uppercase tracking-wide text-emerald-200/70">
            Reference {result.intent.reference} · {new Date(result.createdAt).toLocaleTimeString()}
          </p>
        </div>
      ) : (
        <p className="mt-2 text-xs text-emerald-200/80">
          Execute a simulation to unlock a real-time routing breakdown.
        </p>
      )}
    </div>
  );
}

function ConflictDesk({
  conflicts,
  onResolve,
  processorMap,
  merchantMap,
  isLoading,
}: {
  conflicts: Conflict[];
  onResolve: (conflictId: string) => void;
  processorMap: Record<string, Processor>;
  merchantMap: Record<string, Merchant>;
  isLoading: boolean;
}) {
  return (
    <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-6 shadow-xl">
      <div className="flex items-center justify-between text-amber-100">
        <div>
          <h3 className="text-lg font-semibold">Conflict Resolution Desk</h3>
          <p className="text-xs text-amber-100/70">
            Execute manual playbooks on escalated payment events.
          </p>
        </div>
        <span className="rounded-full border border-amber-200/50 px-3 py-1 text-xs font-semibold">
          {conflicts.filter((conflict) => conflict.state === 'open').length} open
        </span>
      </div>

      <div className="mt-4 space-y-4">
        {isLoading ? (
          <div className="h-14 animate-pulse rounded bg-amber-200/20" />
        ) : conflicts.length === 0 ? (
          <p className="text-xs text-amber-100/70">
            All clear. The routing fabric has no pending escalations.
          </p>
        ) : (
          conflicts.slice(0, 4).map((conflict) => {
            const merchant = merchantMap[conflict.merchantId];
            return (
              <div
                key={conflict.id}
                className="rounded-xl border border-amber-200/30 bg-white/5 p-4 text-xs text-amber-50 backdrop-blur"
              >
                <div className="flex items-center justify-between text-[11px] uppercase tracking-wide">
                  <span>{merchant?.name ?? conflict.merchantId}</span>
                  <span>{new Date(conflict.createdAt).toLocaleString()}</span>
                </div>
                <p className="mt-2 text-sm text-amber-50">
                  {currencySymbols[conflict.currency]}
                  {conflict.amount.toFixed(2)} · {conflict.reason.replace(/-/g, ' ')}
                </p>
                <p className="mt-1 text-[11px] uppercase tracking-wide text-amber-200/70">
                  Suggested fallback: {conflict.suggestedProcessorIds
                    .map((id) => processorMap[id]?.name ?? id)
                    .join(', ')}
                </p>
                {conflict.state === 'open' ? (
                  <button
                    className="mt-3 inline-flex items-center rounded-full bg-amber-400 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-black transition hover:bg-amber-300"
                    onClick={() => onResolve(conflict.id)}
                  >
                    Resolve
                  </button>
                ) : (
                  <p className="mt-3 text-[11px] uppercase tracking-wide text-amber-200/70">
                    Resolved · {conflict.resolutionNote}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function ProcessorMatrix({ processors }: { processors: Processor[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-900 shadow-xl">
      <h3 className="text-lg font-semibold text-slate-900">Processor Matrix</h3>
      <p className="mt-1 text-xs text-slate-600">
        Routing weights, availability signals, and specialization hints.
      </p>

      <div className="mt-4 space-y-3">
        {processors.map((processor) => (
          <div
            key={processor.id}
            className="rounded-xl border border-slate-300/60 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-semibold text-slate-900">{processor.name}</p>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {processor.regions.join(' • ')} · {processor.currencies.join(' ')}
                </p>
              </div>
              <StatusPill status={processor.status} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
              <div>
                <dt className="uppercase tracking-wide text-slate-400">Success</dt>
                <dd className="font-semibold text-slate-900">{(processor.successRate * 100).toFixed(1)}%</dd>
              </div>
              <div>
                <dt className="uppercase tracking-wide text-slate-400">Latency</dt>
                <dd className="font-semibold text-slate-900">
                  {(processor.latencyScore * 100).toFixed(0)} ms index
                </dd>
              </div>
              <div>
                <dt className="uppercase tracking-wide text-slate-400">Priority</dt>
                <dd className="font-semibold text-slate-900">{processor.priority}</dd>
              </div>
              <div>
                <dt className="uppercase tracking-wide text-slate-400">Fee</dt>
                <dd className="font-semibold text-slate-900">{(processor.baseFee * 100).toFixed(2)}%</dd>
              </div>
            </dl>
            {processor.specialization ? (
              <p className="mt-2 text-[11px] uppercase tracking-wide text-slate-500">
                Specialization · {processor.specialization.replace('_', ' ')}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: Processor['status'] }) {
  const color =
    status === 'online' ? 'bg-emerald-500/20 text-emerald-700' : status === 'degraded' ? 'bg-amber-500/20 text-amber-700' : 'bg-rose-500/20 text-rose-700';
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${color}`}>
      {status}
    </span>
  );
}
