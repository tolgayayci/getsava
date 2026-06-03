import { I128MAX, type Request, RequestType } from '@blend-capital/blend-sdk';
import { toStroops } from './amount';
import type { BlendNetworkConfig } from './config';
import { assertSafeRequestType } from './guardrail';

export type WithdrawMode =
  | { readonly kind: 'partial'; readonly humanUsdc: number }
  | { readonly kind: 'all' };

/** A USDC supply-collateral Request (bTokens land in the collateral map). */
export function supplyRequest(cfg: BlendNetworkConfig, humanUsdc: number): Request {
  assertSafeRequestType(RequestType.SupplyCollateral);
  return {
    request_type: RequestType.SupplyCollateral,
    address: cfg.usdcSac,
    amount: toStroops(humanUsdc),
  };
}

/**
 * A USDC withdraw-collateral Request. `{ kind: 'all' }` uses `I128MAX`, which the
 * pool contract clamps to the user's actual position → full exit, no dust, no race
 * with interest accrual.
 */
export function withdrawRequest(cfg: BlendNetworkConfig, mode: WithdrawMode): Request {
  assertSafeRequestType(RequestType.WithdrawCollateral);
  const amount = mode.kind === 'all' ? I128MAX : toStroops(mode.humanUsdc);
  return {
    request_type: RequestType.WithdrawCollateral,
    address: cfg.usdcSac,
    amount,
  };
}
