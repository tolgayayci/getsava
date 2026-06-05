import * as Sentry from '@sentry/react-native';
import PostHog from 'posthog-react-native';
import type { ComponentType } from 'react';

/**
 * Crash reporting (Sentry) + product analytics (PostHog) for T1-D5.
 *
 * Both are NO-OPS unless their `EXPO_PUBLIC_*` keys are set, so local dev, CI,
 * and unconfigured builds run clean. Set the keys in EAS build env / `.env.local`
 * to turn them on; the read-only dashboards (the SCF deliverable) live in the
 * Sentry + PostHog accounts. Sava is non-custodial — no keys/PII ever leave the
 * device, so PII capture is explicitly disabled.
 */

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';
const ENVIRONMENT = process.env.EXPO_PUBLIC_STELLAR_NETWORK ?? 'development';

/** Product-analytics client; undefined until `EXPO_PUBLIC_POSTHOG_KEY` is set. */
export let analytics: PostHog | undefined;

/**
 * Initialize observability once, as early as possible (from `index.ts`, before
 * the app mounts). Safe to call when unconfigured — it simply does nothing.
 */
export function initObservability(): void {
  if (SENTRY_DSN) {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: ENVIRONMENT,
      tracesSampleRate: 0.2,
      sendDefaultPii: false,
    });
  }
  if (POSTHOG_KEY) {
    analytics = new PostHog(POSTHOG_KEY, { host: POSTHOG_HOST });
  }
}

/** Wrap the root component with Sentry's error boundary when configured. */
export function withCrashReporting(Root: ComponentType): ComponentType {
  if (!SENTRY_DSN) {
    return Root;
  }
  return Sentry.wrap(Root as ComponentType<Record<string, unknown>>) as unknown as ComponentType;
}

type EventProperties = Parameters<PostHog['capture']>[1];

/** Fire a product-analytics event. No-op when analytics is unconfigured. */
export function track(event: string, properties?: EventProperties): void {
  analytics?.capture(event, properties);
}
