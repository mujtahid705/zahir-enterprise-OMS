import { sql } from "drizzle-orm";
import { db, type Db, type Tx } from "@/db/client";

export type Actor = { id: string; name: string };

// Every write goes through here (SPEC §13.3, ADR 0001). The settings are
// transaction-local, so log_row_change() attributes exactly this transaction's
// rows and nothing leaks across pooled connections. Writes outside withUser
// fail in the trigger.
//
// `executor` lets DB tests nest the write in their rolled-back transaction
// (as a savepoint). A released savepoint keeps its settings, so they are
// cleared again before returning.
export function withUser<T>(
  user: Actor,
  fn: (tx: Tx) => Promise<T>,
  executor: Db | Tx = db,
): Promise<T> {
  return executor.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.user_id', ${user.id}, true), set_config('app.user_name', ${user.name}, true)`,
    );
    const result = await fn(tx);
    await tx.execute(
      sql`select set_config('app.user_id', '', true), set_config('app.user_name', '', true)`,
    );
    return result;
  });
}
