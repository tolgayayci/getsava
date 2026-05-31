/**
 * @getsava/sdk-blend — the ONLY module allowed to import `@blend-capital/blend-sdk`.
 *
 * Safety guardrail (Layer 2 of the defense-in-depth): YK-468 adds
 * `ALLOWED_REQUEST_TYPES = [SupplyCollateral, WithdrawCollateral] as const`, the
 * derived `SafeRequestType`, an `assertSafeRequestType()` runtime guard, and a
 * lint rule banning direct `@blend-capital/blend-sdk` imports elsewhere. No code
 * path may ever construct Borrow / Repay / Liquidate.
 *
 * Placeholder export keeps the package importable until that lands.
 */
export const SDK_BLEND_PACKAGE = '@getsava/sdk-blend';
