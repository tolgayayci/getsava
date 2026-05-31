/**
 * @getsava/types — shared types across the workspace. Domain types (orders, wallet,
 * pool state, etc.) are added by their stories; this is the foundational set.
 */

/** Stellar network selector used everywhere a network must be disambiguated. */
export type Network = 'testnet' | 'mainnet';

/** Nominal typing helper, e.g. `type StellarAddress = Brand<string, 'StellarAddress'>`. */
export type Brand<T, B extends string> = T & { readonly __brand: B };
