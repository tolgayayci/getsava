import type { CircuitSample } from './store';

export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<{ ok: boolean; status: number }>;
export type LogFn = (event: string, data: Record<string, unknown>) => void;

export interface AlertDeps {
  /** Slack/Discord/generic incoming-webhook URL for on-call (optional). */
  readonly webhookUrl?: string;
  /** Expo push tokens to notify (optional). */
  readonly pushTokens: readonly string[];
  readonly fetch: FetchLike;
  readonly log: LogFn;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function summary(s: CircuitSample): string {
  const why = s.reasons.join(', ') || 'unknown';
  return `🚨 Sava circuit breaker TRIPPED — deposits halted (${why})${s.forced ? ' [forced/staging]' : ''}. Withdrawals stay open. coverage=${(s.backstopCoverageRatio * 100).toFixed(1)}% oracleΔ=${(s.oracleDivergencePct * 100).toFixed(3)}% status=${s.poolStatus}`;
}

/**
 * Fire all configured alert channels for a fresh trip: a structured log (always),
 * the on-call webhook, and Expo push to registered devices. Each channel is
 * best-effort and isolated — a failing channel is logged and never throws, so
 * alerting can never break the sampling loop.
 */
export async function fireAlerts(sample: CircuitSample, deps: AlertDeps): Promise<void> {
  const text = summary(sample);
  // 1) Structured log — the always-on, queryable record (Cloudflare tail / logpush).
  deps.log('circuit_trip', {
    reasons: sample.reasons,
    forced: sample.forced,
    backstopCoverageRatio: sample.backstopCoverageRatio,
    bRateDriftPct: sample.bRateDriftPct,
    oracleDivergencePct: sample.oracleDivergencePct,
    poolStatus: sample.poolStatus,
    ts: sample.ts,
  });

  const tasks: Promise<void>[] = [];

  // 2) On-call webhook (Slack-compatible payload).
  if (deps.webhookUrl) {
    tasks.push(
      (async () => {
        try {
          const res = await deps.fetch(deps.webhookUrl as string, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text }),
          });
          if (!res.ok) {
            deps.log('circuit_alert_webhook_failed', { status: res.status });
          }
        } catch (e) {
          deps.log('circuit_alert_webhook_error', { message: String(e) });
        }
      })(),
    );
  }

  // 3) Expo push to each registered device.
  if (deps.pushTokens.length > 0) {
    const messages = deps.pushTokens.map((to) => ({
      to,
      title: 'Sava — deposits paused',
      body: 'A safety check paused new deposits. Your funds are safe and withdrawals stay open.',
      priority: 'high',
      sound: 'default',
      data: { type: 'circuit_trip', reasons: sample.reasons },
    }));
    tasks.push(
      (async () => {
        try {
          const res = await deps.fetch(EXPO_PUSH_URL, {
            method: 'POST',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify(messages),
          });
          if (!res.ok) {
            deps.log('circuit_alert_push_failed', { status: res.status });
          }
        } catch (e) {
          deps.log('circuit_alert_push_error', { message: String(e) });
        }
      })(),
    );
  }

  await Promise.all(tasks);
}

/**
 * A fresh trip is a transition worth alerting on: previously healthy → now
 * tripped, OR a new reason appearing while already tripped. Avoids re-alerting
 * on every sample of a sustained trip.
 */
export function isFreshTrip(prev: CircuitSample | null, next: CircuitSample): boolean {
  if (!next.tripped) {
    return false;
  }
  if (!prev?.tripped) {
    return true;
  }
  const prevReasons = new Set(prev.reasons);
  return next.reasons.some((r) => !prevReasons.has(r));
}
