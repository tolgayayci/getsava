import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi';
import { type CircuitMetrics, type CircuitStatus, circuitService } from '../circuit';
import type { Env } from '../config';
import { jsonError } from './schemas';

type App = OpenAPIHono<{ Bindings: Env }>;

const StatusSchema = z
  .object({
    tripped: z
      .boolean()
      .openapi({ description: 'True → the app HALTS new supply. Withdrawals stay open.' }),
    reasons: z.array(z.string()).openapi({ description: 'Active trip reasons' }),
    forced: z
      .boolean()
      .openapi({ description: 'Trip driven by the CIRCUIT_FORCE_TRIP staging override' }),
    sampledAt: z.number().nullable(),
    stale: z
      .boolean()
      .openapi({ description: 'No fresh sample within 3 min (monitor may be down)' }),
    backstopCoverageRatio: z.number().nullable(),
    bRateDriftPct: z.number().nullable(),
    oracleDivergencePct: z.number().nullable(),
    poolStatus: z.number().nullable(),
    supplyApy: z.number().nullable(),
  })
  .openapi('CircuitStatus');

const statusRoute = createRoute({
  method: 'get',
  path: '/circuit/status',
  tags: ['Circuit'],
  summary: 'Current circuit-breaker state',
  description:
    'The state the app polls before every deposit. `tripped` halts new supply (withdrawals always allowed). Reflects the CIRCUIT_FORCE_TRIP env override live, so a staging trip is observed on the next poll.',
  responses: {
    200: {
      content: { 'application/json': { schema: StatusSchema } },
      description: 'Current state',
    },
  },
});

const metricsRoute = createRoute({
  method: 'get',
  path: '/circuit/metrics',
  tags: ['Circuit'],
  summary: 'Circuit-breaker metrics time series',
  description:
    'Stored samples over the last `days` (default 7) — the data behind the read-only dashboard.',
  request: {
    query: z.object({
      days: z.coerce.number().min(1).max(90).optional().openapi({ example: 7 }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z
            .object({
              windowDays: z.number(),
              count: z.number(),
              trips: z.number(),
              currentlyTripped: z.boolean(),
              samples: z.array(z.record(z.string(), z.unknown())),
            })
            .openapi('CircuitMetrics'),
        },
      },
      description: 'Metrics window',
    },
  },
});

const sampleRoute = createRoute({
  method: 'post',
  path: '/circuit/sample',
  tags: ['Circuit'],
  summary: 'Force an immediate sample (manual trigger)',
  description:
    'Samples the 3 sources now, evaluates, persists, and fires alerts on a fresh trip. Bearer-gated by CIRCUIT_ADMIN_TOKEN. Lets a reviewer observe a trip within seconds of setting the env override (no wait for the 1-min cron).',
  responses: {
    200: { content: { 'application/json': { schema: StatusSchema } }, description: 'Sample taken' },
    401: { content: jsonError, description: 'Missing or invalid admin token' },
    503: {
      content: jsonError,
      description: 'Not configured (no CIRCUIT_ADMIN_TOKEN) or sample failed',
    },
  },
});

const pushTokenRoute = createRoute({
  method: 'post',
  path: '/circuit/push-tokens',
  tags: ['Circuit'],
  summary: 'Register an Expo push token for trip alerts',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({ token: z.string().openapi({ example: 'ExponentPushToken[xxx]' }) }),
        },
      },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } },
      description: 'Registered',
    },
    400: { content: jsonError, description: 'Invalid token' },
  },
});

function statusBody(s: CircuitStatus) {
  return {
    tripped: s.tripped,
    reasons: [...s.reasons],
    forced: s.forced,
    sampledAt: s.sampledAt,
    stale: s.stale,
    backstopCoverageRatio: s.backstopCoverageRatio,
    bRateDriftPct: s.bRateDriftPct,
    oracleDivergencePct: s.oracleDivergencePct,
    poolStatus: s.poolStatus,
    supplyApy: s.supplyApy,
  };
}

export function registerCircuit(app: App): void {
  app.openapi(statusRoute, async (c) => {
    const status = await circuitService(c.env).getStatus();
    return c.json(statusBody(status), 200);
  });

  app.openapi(metricsRoute, async (c) => {
    const { days } = c.req.valid('query');
    const m = await circuitService(c.env).getMetrics(days ?? 7);
    return c.json(
      {
        windowDays: m.windowDays,
        count: m.count,
        trips: m.trips,
        currentlyTripped: m.currentlyTripped,
        samples: m.samples as unknown as Record<string, unknown>[],
      },
      200,
    );
  });

  app.openapi(sampleRoute, async (c) => {
    const admin = c.env.CIRCUIT_ADMIN_TOKEN;
    if (!admin) {
      return c.json({ error: 'not_configured', message: 'CIRCUIT_ADMIN_TOKEN is not set' }, 503);
    }
    const auth = c.req.header('authorization');
    if (auth !== `Bearer ${admin}`) {
      return c.json({ error: 'unauthorized', message: 'invalid admin token' }, 401);
    }
    try {
      const svc = circuitService(c.env);
      await svc.sampleAndStore();
      return c.json(statusBody(await svc.getStatus()), 200);
    } catch (e) {
      return c.json(
        { error: 'sample_failed', message: e instanceof Error ? e.message : 'error' },
        503,
      );
    }
  });

  app.openapi(pushTokenRoute, async (c) => {
    const { token } = c.req.valid('json');
    if (!token.startsWith('ExponentPushToken[') && !token.startsWith('ExpoPushToken[')) {
      return c.json({ error: 'bad_request', message: 'not an Expo push token' }, 400);
    }
    await circuitService(c.env).registerPushToken(token);
    return c.json({ ok: true }, 200);
  });

  // Read-only HTML dashboard (no controls) — the submission's dashboard URL.
  app.get('/circuit/dashboard', async (c) => {
    const m = await circuitService(c.env).getMetrics(7);
    return c.html(renderDashboard(m));
  });
}

function esc(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch] as string,
  );
}

/** Tiny SVG sparkline of backstop coverage ratio across the window. */
function sparkline(samples: CircuitMetrics['samples']): string {
  if (samples.length < 2) {
    return '<p class="muted">Not enough samples yet — the chart fills in as the cron runs.</p>';
  }
  const w = 760;
  const h = 120;
  const vals = samples.map((s) => s.backstopCoverageRatio);
  const min = Math.min(...vals, 0.08);
  const max = Math.max(...vals, 0.12);
  const span = max - min || 1;
  const pts = samples
    .map((s, i) => {
      const x = (i / (samples.length - 1)) * w;
      const y = h - ((s.backstopCoverageRatio - min) / span) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const thresholdY = h - ((0.08 - min) / span) * h;
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none">
    <line x1="0" y1="${thresholdY.toFixed(1)}" x2="${w}" y2="${thresholdY.toFixed(1)}" stroke="#c0392b" stroke-dasharray="4" />
    <polyline fill="none" stroke="#2d7d46" stroke-width="2" points="${pts}" />
  </svg>
  <p class="muted">Backstop coverage ratio (green) vs the 8% halt threshold (red dashed).</p>`;
}

function renderDashboard(m: CircuitMetrics): string {
  const latest = m.samples.length ? m.samples[m.samples.length - 1] : null;
  const state = m.currentlyTripped ? 'TRIPPED — new deposits halted' : 'HEALTHY — deposits open';
  const color = m.currentlyTripped ? '#c0392b' : '#2d7d46';
  const recent = [...m.samples]
    .reverse()
    .slice(0, 30)
    .map((s) => {
      const when = new Date(s.ts).toISOString().replace('T', ' ').slice(0, 19);
      return `<tr>
        <td>${when}</td>
        <td>${s.tripped ? `⛔ ${esc(s.reasons.join(', '))}${s.forced ? ' (forced)' : ''}` : '✅ ok'}</td>
        <td>${(s.backstopCoverageRatio * 100).toFixed(1)}%</td>
        <td>${s.bRateDriftPct === null ? '—' : `${(s.bRateDriftPct * 100).toFixed(3)}%`}</td>
        <td>${(s.oracleDivergencePct * 100).toFixed(3)}%</td>
        <td>${s.poolStatus}</td>
      </tr>`;
    })
    .join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sava — Circuit Breaker</title>
  <style>
    body { font: 14px/1.5 -apple-system, system-ui, sans-serif; max-width: 820px; margin: 32px auto; padding: 0 16px; color: #1a1a1a; }
    h1 { font-size: 20px; } .muted { color: #777; font-size: 12px; }
    .badge { display:inline-block; padding:6px 12px; border-radius:8px; color:#fff; font-weight:600; background:${color}; }
    table { border-collapse: collapse; width: 100%; margin-top: 16px; font-size: 13px; }
    th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #eee; }
    .grid { display:flex; gap:16px; flex-wrap:wrap; margin:16px 0; }
    .card { border:1px solid #eee; border-radius:8px; padding:12px 14px; min-width:150px; }
    .card b { display:block; font-size:18px; }
  </style></head><body>
  <h1>Sava — Blend Circuit Breaker <span class="muted">(read-only)</span></h1>
  <p><span class="badge">${esc(state)}</span> &nbsp; <span class="muted">withdrawals are always allowed</span></p>
  <div class="grid">
    <div class="card"><span class="muted">Backstop coverage</span><b>${latest ? `${(latest.backstopCoverageRatio * 100).toFixed(1)}%` : '—'}</b><span class="muted">min 8%</span></div>
    <div class="card"><span class="muted">Oracle divergence</span><b>${latest ? `${(latest.oracleDivergencePct * 100).toFixed(3)}%` : '—'}</b><span class="muted">max 0.5%</span></div>
    <div class="card"><span class="muted">Pool status</span><b>${latest ? latest.poolStatus : '—'}</b><span class="muted">halt ≥ 4</span></div>
    <div class="card"><span class="muted">Samples (${m.windowDays}d)</span><b>${m.count}</b><span class="muted">${m.trips} trips</span></div>
  </div>
  ${sparkline(m.samples)}
  <h2 style="font-size:15px;margin-top:24px">Recent samples</h2>
  <table><thead><tr><th>UTC</th><th>State</th><th>Coverage</th><th>bRate drift</th><th>Oracle Δ</th><th>Status</th></tr></thead>
  <tbody>${recent || '<tr><td colspan="6" class="muted">No samples yet.</td></tr>'}</tbody></table>
  <p class="muted" style="margin-top:24px">Auto-sampled every minute by the Worker cron; this page is read-only. Thresholds: backstop coverage ≥ 8%, bRate drift ≤ ±2%/5min, oracle divergence ≤ ±0.5%, pool status &lt; 4.</p>
  </body></html>`;
}
