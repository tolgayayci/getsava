import { findUsdcSettlement, sendUsdc } from '@getsava/sdk-stellar';
import { neon } from '@neondatabase/serverless';
import { type Env, resolveMercuryoConfig } from '../config';
import { InMemoryOrderStore, type OrderStore, OrdersService } from '../orders';
import { PgOrderStore, type SqlExecutor } from '../orders/pg-store';

/**
 * Builds the {@link OrdersService} from the request env. With DATABASE_URL set
 * it uses Postgres (durable, idempotent dedup); otherwise a per-isolate
 * in-memory store for local dev. The settlement deps (deliverUsdc/findSettlement)
 * are wired for the cron sweep but unused by the D6 widget-url/webhook routes.
 */

let memoryStore: InMemoryOrderStore | null = null;

/** Reset the dev in-memory store (test isolation only). */
export function resetOrderStoreForTests(): void {
  memoryStore = null;
}

function storeFor(env: Env): OrderStore {
  if (env.DATABASE_URL) {
    return new PgOrderStore(neon(env.DATABASE_URL) as unknown as SqlExecutor);
  }
  memoryStore ??= new InMemoryOrderStore();
  return memoryStore;
}

export function ordersService(env: Env): OrdersService {
  return new OrdersService(storeFor(env), resolveMercuryoConfig(env), {
    generateId: () => crypto.randomUUID(),
    now: () => Date.now(),
    deliverUsdc: sendUsdc,
    findSettlement: findUsdcSettlement,
    log: (event, data) => {
      console.log(JSON.stringify({ event, ...data }));
    },
  });
}
