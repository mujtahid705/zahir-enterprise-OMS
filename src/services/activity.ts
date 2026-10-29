import {
  and,
  asc,
  countDistinct,
  desc,
  eq,
  exists,
  gte,
  ilike,
  inArray,
  lt,
  min,
  or,
  sql,
  type SQL,
  type SQLWrapper,
} from "drizzle-orm";
import { db, type Db, type Tx } from "@/db/client";
import { activityLog, orders, profiles } from "@/db/schema";
import {
  ACTION_TYPES,
  RECORD_TYPES,
  dayOf,
  groupEntries,
  type ActivityEntry,
  type ActivityFilters,
  type ActivityRow,
  type LoggedTable,
} from "@/lib/activity-log";
import type { CurrentUser } from "@/lib/auth";
import { TIMEZONE } from "@/lib/dates";
import { authorize, containing } from "@/services/master-data";

// Reads the Activity Log (SPEC §11.2) for the /activity screen, its CSV
// export and the History tabs. One entry is one save (tx_id, ADR 0001); a
// filter picks the saves, and each entry shows every row of its save.

export const ACTIVITY_PAGE_SIZE = 25;

type Deps = { executor?: Db | Tx };

// A History tab's record: an Order with its items, Work Orders and events,
// or any other record by its table and id.
export type HistoryScope =
  { orderId: string } | { entityType: LoggedTable; entityId: string };

// A constant, inlined so the day expression matches itself in GROUP BY.
const zone = sql.raw(`'${TIMEZONE}'`);

// The first moment of a Dhaka calendar day.
const dhakaStart = (day: string) =>
  sql`((${day}::date)::timestamp at time zone ${zone})`;

function where(
  filters: Partial<ActivityFilters>,
  scope?: HistoryScope,
): SQL | undefined {
  const { query, from, to, userId, recordType, actionType } = filters;
  return and(
    from ? gte(activityLog.occurredAt, dhakaStart(from)) : undefined,
    to
      ? lt(activityLog.occurredAt, sql`${dhakaStart(to)} + interval '1 day'`)
      : undefined,
    userId ? eq(activityLog.userId, userId) : undefined,
    recordType
      ? inArray(activityLog.entityType, [...RECORD_TYPES[recordType].tables])
      : undefined,
    actionType
      ? inArray(activityLog.action, [...ACTION_TYPES[actionType].actions])
      : undefined,
    query
      ? or(
          ilike(activityLog.entityLabel, containing(query)),
          // A failed sign-in has no record, only the email tried.
          ilike(sql`${activityLog.details} ->> 'email'`, containing(query)),
          // An item's or Work Order's row is found by its Order's number.
          exists(
            db
              .select({ one: sql`1` })
              .from(orders)
              .where(
                and(
                  eq(orders.id, activityLog.orderId),
                  ilike(orders.orderNo, containing(query)),
                ),
              ),
          ),
        )
      : undefined,
    scope && "orderId" in scope
      ? eq(activityLog.orderId, scope.orderId)
      : undefined,
    scope && "entityId" in scope
      ? and(
          eq(activityLog.entityType, scope.entityType),
          eq(activityLog.entityId, scope.entityId),
        )
      : undefined,
  );
}

// Every row of the given saves (tx_ids, or a query for them), newest save
// first, as entries.
async function entriesOf(
  executor: Db | Tx,
  txIds: number[] | SQLWrapper,
): Promise<ActivityEntry[]> {
  if (Array.isArray(txIds) && !txIds.length) return [];
  const rows = await executor
    .select({
      id: activityLog.id,
      txId: activityLog.txId,
      occurredAt: activityLog.occurredAt,
      kind: activityLog.kind,
      action: activityLog.action,
      userId: activityLog.userId,
      userName: activityLog.userName,
      entityType: activityLog.entityType,
      entityId: activityLog.entityId,
      entityLabel: activityLog.entityLabel,
      orderId: activityLog.orderId,
      orderNo: orders.orderNo,
      changes: activityLog.changes,
      details: activityLog.details,
    })
    .from(activityLog)
    .leftJoin(orders, eq(orders.id, activityLog.orderId))
    .where(inArray(activityLog.txId, txIds))
    .orderBy(
      desc(activityLog.occurredAt),
      desc(activityLog.txId),
      asc(activityLog.id),
    );
  return groupEntries(rows as ActivityRow[]);
}

// The saves matching the filters, newest first.
function savesQuery(executor: Db | Tx, condition: SQL | undefined) {
  const at = min(activityLog.occurredAt);
  return executor
    .select({ txId: activityLog.txId })
    .from(activityLog)
    .where(condition)
    .groupBy(activityLog.txId)
    .orderBy(desc(at), desc(activityLog.txId))
    .$dynamic();
}

// One page of entries grouped by Dhaka day, each day with its count of
// entries across the whole filtered result.
async function list(
  actor: CurrentUser,
  filters: Partial<ActivityFilters>,
  { executor = db, scope }: Deps & { scope?: HistoryScope } = {},
) {
  authorize(actor, "viewActivityLog");
  const condition = where(filters, scope);
  const page = filters.page ?? 1;
  const [saves, [{ total } = { total: 0 }]] = await Promise.all([
    savesQuery(executor, condition)
      .limit(ACTIVITY_PAGE_SIZE)
      .offset((page - 1) * ACTIVITY_PAGE_SIZE),
    executor
      .select({ total: countDistinct(activityLog.txId) })
      .from(activityLog)
      .where(condition),
  ]);
  const entries = await entriesOf(
    executor,
    saves.map((save) => save.txId),
  );

  const dayNames = [...new Set(entries.map((e) => dayOf(e.occurredAt)))];
  const dhakaDay = sql<string>`to_char(${activityLog.occurredAt} at time zone ${zone}, 'YYYY-MM-DD')`;
  const counts = dayNames.length
    ? await executor
        .select({ day: dhakaDay, count: countDistinct(activityLog.txId) })
        .from(activityLog)
        .where(and(condition, inArray(dhakaDay, dayNames)))
        .groupBy(dhakaDay)
    : [];
  const countOf = new Map(counts.map((row) => [row.day, row.count]));
  const days = dayNames.map((day) => ({
    day,
    count: countOf.get(day) ?? 0,
    entries: entries.filter((entry) => dayOf(entry.occurredAt) === day),
  }));
  return { days, total };
}

// Every entry matching the filters, for the CSV export.
async function all(
  actor: CurrentUser,
  filters: Partial<ActivityFilters>,
  { executor = db }: Deps = {},
): Promise<ActivityEntry[]> {
  authorize(actor, "viewActivityLog");
  return entriesOf(
    executor,
    executor
      .selectDistinct({ txId: activityLog.txId })
      .from(activityLog)
      .where(where(filters)),
  );
}

// The User filter's choices: everyone, deactivated Users included.
async function userOptions(actor: CurrentUser, { executor = db }: Deps = {}) {
  authorize(actor, "viewActivityLog");
  return executor
    .select({ id: profiles.id, name: profiles.fullName })
    .from(profiles)
    .orderBy(asc(profiles.fullName));
}

export const activity = { list, all, userOptions };
