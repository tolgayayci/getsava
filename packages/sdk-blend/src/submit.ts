import { type SignRawHashFn, signTransaction } from '@getsava/sdk-stellar';
import type { Network } from '@getsava/types';
import { TransactionBuilder } from '@stellar/stellar-base';
import { Api, Server } from '@stellar/stellar-sdk/rpc';
import { blendConfig } from './config';

export interface SubmitResult {
  readonly hash: string;
  readonly status: 'SUCCESS' | 'FAILED';
}

const POLL_ATTEMPTS = 20;

/**
 * Sign a prepared Soroban XDR with Privy raw-hash signing (the user is the source,
 * so one envelope signature authorizes the whole invocation), submit it via Soroban
 * RPC, and poll to a terminal status. Returns the Stellar Expert tx hash.
 */
export async function signAndSubmit(
  network: Network,
  preparedXdr: string,
  user: string,
  signRawHash: SignRawHashFn,
): Promise<SubmitResult> {
  const cfg = blendConfig(network);
  const signedXdr = await signTransaction(network, preparedXdr, user, signRawHash);
  const server = new Server(cfg.rpcUrl, { allowHttp: cfg.rpcUrl.startsWith('http://') });
  const signedTx = TransactionBuilder.fromXDR(signedXdr, cfg.networkPassphrase);
  const sent = await server.sendTransaction(signedTx);
  if (sent.status === 'ERROR') {
    throw new Error(
      `[sdk-blend] sendTransaction rejected: ${JSON.stringify(sent.errorResult ?? sent.status)}`,
    );
  }
  const final = await server.pollTransaction(sent.hash, { attempts: POLL_ATTEMPTS });
  return {
    hash: sent.hash,
    status: final.status === Api.GetTransactionStatus.SUCCESS ? 'SUCCESS' : 'FAILED',
  };
}
