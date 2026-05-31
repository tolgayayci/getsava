// Polyfills required by @stellar/stellar-sdk, Privy, and jose. This module is
// imported as the very first thing in the app entry (index.ts), before any
// module that may pull in stellar-base or crypto.

// 1. Patch Hermes's broken TypedArray.prototype.subarray BEFORE any Buffer /
//    stellar-base use. Without it, tx.toEnvelope().toXDR('base64') returns
//    garbage on Hermes (facebook/hermes#1495).
import '@exodus/patch-broken-hermes-typed-arrays';

// 2. crypto.getRandomValues — needed by Privy, jose, and keypair generation.
import 'react-native-get-random-values';

// 3. Buffer global — required by @stellar/stellar-base and other crypto libs.
import { Buffer } from 'buffer';

const globalWithBuffer = globalThis as typeof globalThis & {
  Buffer?: typeof Buffer;
};
if (typeof globalWithBuffer.Buffer === 'undefined') {
  globalWithBuffer.Buffer = Buffer;
}
