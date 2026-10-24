import { sql } from "drizzle-orm";
import { z } from "zod";
import type { Tx } from "@/db/client";
import { codeSequences } from "@/db/schema";
import type { CurrentUser } from "@/lib/auth";
import { NotAllowedError, UserInputError } from "@/lib/errors";
import { formatCode } from "@/lib/numbering";
import { can, type Permission } from "@/lib/permissions";

// Shared by the master data services: Customers, Suppliers, Products.

export const MASTER_DATA_PAGE_SIZE = 25;

export function authorize(actor: CurrentUser, permission: Permission) {
  if (!can(actor.role, permission)) throw new NotAllowedError(permission);
}

export function parse<T, I>(schema: z.ZodType<T, I>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new UserInputError(result.error.issues[0]!.message);
  return result.data;
}

// An ILIKE pattern matching `query` anywhere, wildcards escaped.
export function containing(query: string): string {
  return `%${query.trim().replace(/[\\%_]/g, "\\$&")}%`;
}

// Takes the next value of the prefix's global counter (SPEC §14
// code_sequences). The row lock serialises concurrent creates; a code taken by
// a record that is later deleted is never handed out again.
export async function nextCode(tx: Tx, prefix: string): Promise<string> {
  const [{ value }] = await tx
    .insert(codeSequences)
    .values({ prefix, lastValue: 1 })
    .onConflictDoUpdate({
      target: codeSequences.prefix,
      set: { lastValue: sql`${codeSequences.lastValue} + 1` },
    })
    .returning({ value: codeSequences.lastValue });
  return formatCode(prefix, value);
}

// Drizzle wraps the Postgres error; its SQLSTATE is on `cause`.
export function isForeignKeyViolation(error: unknown): boolean {
  const cause = error instanceof Error ? error.cause : undefined;
  return (cause as { code?: string } | undefined)?.code === "23503";
}
