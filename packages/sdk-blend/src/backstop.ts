import { Backstop, BackstopPoolEst, BackstopPoolV2 } from '@blend-capital/blend-sdk';
import { type BlendNetworkConfig, blendNetwork } from './config';

export interface BackstopHealth {
  /** Backstop coverage size in USD (first-loss capital protecting suppliers). */
  readonly totalSpotValueUsd: number;
  /** Fraction of the backstop queued-for-withdrawal (0..1). */
  readonly q4wPercentage: number;
}

/** Read backstop coverage + queued-for-withdrawal for the pool (D1 circuit-breaker input). */
export async function readBackstopHealth(cfg: BlendNetworkConfig): Promise<BackstopHealth> {
  const net = blendNetwork(cfg);
  const [backstop, backstopPool] = await Promise.all([
    Backstop.load(net, cfg.backstopId),
    BackstopPoolV2.load(net, cfg.backstopId, cfg.poolId),
  ]);
  const est = BackstopPoolEst.build(backstop.backstopToken, backstopPool.poolBalance);
  return { totalSpotValueUsd: est.totalSpotValue, q4wPercentage: est.q4wPercentage };
}
