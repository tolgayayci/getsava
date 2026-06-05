// Polyfills MUST run before anything else (stellar-sdk / Privy / jose need them).
import './src/polyfills';

import { registerRootComponent } from 'expo';
import { App } from './App';

registerRootComponent(App);
