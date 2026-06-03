import { PoolContractV2, type Request } from '@blend-capital/blend-sdk';
import { fetchAccount } from '@getsava/sdk-stellar';
import { Account, BASE_FEE, TransactionBuilder, xdr } from '@stellar/stellar-base';
import { Server } from '@stellar/stellar-sdk/rpc';
import type { BlendNetworkConfig } from './config';
import { supplyRequest, type WithdrawMode, withdrawRequest } from './request';

export interface BuildResult {
  /** Post-simulation, footprint+fee+auth assembled, unsigned XDR — ready to sign. */
  readonly preparedXdr: string;
}

const SUBMIT_TIMEOUT_SECONDS = 300;

function sorobanServer(cfg: BlendNetworkConfig): Server {
  return new Server(cfg.rpcUrl, { allowHttp: cfg.rpcUrl.startsWith('http://') });
}

/**
 * Build the Blend `submit` invokeHostFunction op (base64 XDR). Pure — no network.
 *
 * INVARIANT: from = spender = to = `user` = the tx source = the signer. This is
 * exactly what makes source-account authorization sufficient: the contract calls
 * `spender.require_auth()` (and `from.require_auth()` only when from≠spender), and
 * the envelope signature satisfies it — so NO separate auth-entry signing is needed.
 * If a fee-payer/source ever differs from the user, this invariant breaks.
 */
export function submitOpXdr(cfg: BlendNetworkConfig, user: string, requests: Request[]): string {
  return new PoolContractV2(cfg.poolId).submit({
    from: user,
    spender: user,
    to: user,
    requests,
  });
}

async function buildAndPrepare(
  cfg: BlendNetworkConfig,
  user: string,
  requests: Request[],
): Promise<BuildResult> {
  const op = xdr.Operation.fromXDR(submitOpXdr(cfg, user, requests), 'base64');
  const account = await fetchAccount(cfg.network, user);
  if (account === null) {
    throw new Error('[sdk-blend] source account not found on Horizon — fund the wallet first');
  }
  const source = new Account(user, account.sequence);
  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: cfg.networkPassphrase,
  })
    .addOperation(op)
    .setTimeout(SUBMIT_TIMEOUT_SECONDS)
    .build();
  // Simulate + assemble (footprint, resource fee, Soroban auth) — the
  // simulate-before-submit guardrail. Surfaces sim/restore errors before signing.
  const prepared = await sorobanServer(cfg).prepareTransaction(tx);
  return { preparedXdr: prepared.toXDR() };
}

export async function buildSupplyTx(
  cfg: BlendNetworkConfig,
  user: string,
  humanUsdc: number,
): Promise<BuildResult> {
  return buildAndPrepare(cfg, user, [supplyRequest(cfg, humanUsdc)]);
}

export async function buildWithdrawTx(
  cfg: BlendNetworkConfig,
  user: string,
  mode: WithdrawMode,
): Promise<BuildResult> {
  return buildAndPrepare(cfg, user, [withdrawRequest(cfg, mode)]);
}
