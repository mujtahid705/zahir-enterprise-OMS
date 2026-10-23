import { TransactionRollbackError } from "drizzle-orm/errors";
import { afterAll, it } from "vitest";
import { db, type Tx } from "@/db/client";

afterAll(() => db.$client.end());

// Runs fn in a transaction that is always rolled back, never committed
// (ADR 0002): Activity Log rows can't be deleted and committed test orders
// would burn real order numbers.
export async function inRollback(fn: (tx: Tx) => Promise<void>) {
  try {
    await db.transaction(async (tx) => {
      await fn(tx);
      tx.rollback();
    });
  } catch (error) {
    if (!(error instanceof TransactionRollbackError)) throw error;
  }
}

// A DB test: fn gets a transaction that is rolled back afterwards.
export function dbTest(name: string, fn: (tx: Tx) => Promise<void>) {
  it(name, () => inRollback(fn));
}

// Runs fn in a savepoint so an expected error doesn't abort the test
// transaction.
export function inSavepoint<T>(tx: Tx, fn: (sp: Tx) => Promise<T>) {
  return tx.transaction(fn);
}
