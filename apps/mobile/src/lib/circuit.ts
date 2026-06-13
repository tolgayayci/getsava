import { useEffect, useRef, useState } from 'react';

/**
 * Client for the backend circuit breaker (T2.D1). The app polls /circuit/status
 * and HALTS new supply when tripped; withdrawals are never gated. The status
 * endpoint is public (no secrets) and reflects the staging override live, so a
 * trip surfaces on the next poll. Fail-open on a network error: a transient
 * outage of the monitor must never brick deposits.
 */

const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? 'https://api.getsava.app').replace(/\/+$/, '');

export type CircuitReason =
  | 'backstop_coverage'
  | 'brate_drift'
  | 'oracle_divergence'
  | 'pool_status';

export interface CircuitStatus {
  readonly tripped: boolean;
  readonly reasons: CircuitReason[];
  readonly forced: boolean;
  readonly stale: boolean;
  readonly sampledAt: number | null;
  readonly backstopCoverageRatio: number | null;
  readonly oracleDivergencePct: number | null;
  readonly poolStatus: number | null;
}

export const HEALTHY_STATUS: CircuitStatus = {
  tripped: false,
  reasons: [],
  forced: false,
  stale: false,
  sampledAt: null,
  backstopCoverageRatio: null,
  oracleDivergencePct: null,
  poolStatus: null,
};

/** Thrown by the supply guard when the breaker is tripped. */
export class CircuitTrippedError extends Error {
  constructor(readonly reasons: CircuitReason[]) {
    super(`Deposits are paused (${reasons.join(', ') || 'safety check'})`);
    this.name = 'CircuitTrippedError';
  }
}

export async function fetchCircuitStatus(signal?: AbortSignal): Promise<CircuitStatus> {
  try {
    const res = await fetch(`${API_BASE}/circuit/status`, signal ? { signal } : undefined);
    if (!res.ok) {
      return HEALTHY_STATUS;
    }
    const body = (await res.json()) as Partial<CircuitStatus>;
    return { ...HEALTHY_STATUS, ...body, reasons: (body.reasons ?? []) as CircuitReason[] };
  } catch {
    return HEALTHY_STATUS;
  }
}

/**
 * Authoritative pre-deposit gate — call right before building a supply tx. Throws
 * {@link CircuitTrippedError} when the breaker is tripped so the deposit is
 * blocked. Withdrawals never call this.
 */
export async function assertSupplyAllowed(): Promise<void> {
  const status = await fetchCircuitStatus();
  if (status.tripped) {
    throw new CircuitTrippedError(status.reasons);
  }
}

/** Poll the circuit status on an interval (default 15s → a trip shows within 30s). */
export function useCircuit(pollMs = 15_000): CircuitStatus {
  const [status, setStatus] = useState<CircuitStatus>(HEALTHY_STATUS);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    const tick = async () => {
      const next = await fetchCircuitStatus(controller.signal);
      if (mounted.current) {
        setStatus(next);
      }
    };
    void tick();
    const id = setInterval(() => void tick(), pollMs);
    return () => {
      mounted.current = false;
      controller.abort();
      clearInterval(id);
    };
  }, [pollMs]);

  return status;
}
