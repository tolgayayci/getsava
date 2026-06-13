import type { CircuitState, TripReason } from '@getsava/sdk-blend';

const VALID: readonly TripReason[] = [
  'backstop_coverage',
  'brate_drift',
  'oracle_divergence',
  'pool_status',
];

function isTripReason(s: string): s is TripReason {
  return (VALID as readonly string[]).includes(s);
}

/**
 * Parse the CIRCUIT_FORCE_TRIP env override (the staging trip mechanism). Accepts
 * a single reason or a comma-separated list; 'none'/empty/unset → no override.
 * Unknown tokens are ignored. This is how a reviewer trips any of the conditions
 * in staging without waiting for a real on-chain event.
 */
export function parseForcedReasons(raw?: string): TripReason[] {
  if (!raw || raw.trim().toLowerCase() === 'none') {
    return [];
  }
  const seen = new Set<TripReason>();
  for (const tok of raw.split(',')) {
    const t = tok.trim();
    if (isTripReason(t)) {
      seen.add(t);
    }
  }
  return [...seen];
}

/** Merge forced reasons into a real evaluation. Withdrawals are never affected. */
export function applyOverride(
  state: CircuitState,
  forced: readonly TripReason[],
): { state: CircuitState; forced: boolean } {
  if (forced.length === 0) {
    return { state, forced: false };
  }
  const reasons = [...new Set<TripReason>([...state.reasons, ...forced])];
  return { state: { ...state, tripped: true, reasons }, forced: true };
}
