import { RequestType } from '@blend-capital/blend-sdk';

/**
 * Supply-only invariant — Layer 2 of Sava's defense-in-depth (D1). The ONLY
 * Blend request types Sava may ever build. Every Request constructed in this
 * package passes through {@link assertSafeRequestType}, so Borrow(4), Repay(5),
 * and the auction fills (6–9) are structurally unreachable.
 */
export const ALLOWED_REQUEST_TYPES = [
  RequestType.SupplyCollateral, // 2
  RequestType.WithdrawCollateral, // 3
] as const;

export type SafeRequestType = (typeof ALLOWED_REQUEST_TYPES)[number];

export function assertSafeRequestType(rt: RequestType): asserts rt is SafeRequestType {
  if (rt !== RequestType.SupplyCollateral && rt !== RequestType.WithdrawCollateral) {
    throw new Error(
      `[sdk-blend] forbidden request_type ${rt}: supply-only allows SupplyCollateral(2)/WithdrawCollateral(3) only`,
    );
  }
}
