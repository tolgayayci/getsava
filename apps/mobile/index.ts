// Polyfills MUST run before anything else (stellar-sdk / Privy / jose need them).
import './src/polyfills';

import { registerRootComponent } from 'expo';
import { App } from './App';
import { initObservability, withCrashReporting } from './src/observability';

// Crash reporting + analytics (no-op unless EXPO_PUBLIC_SENTRY_DSN / POSTHOG_KEY set).
initObservability();

registerRootComponent(withCrashReporting(App));
