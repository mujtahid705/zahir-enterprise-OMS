import postgres from "postgres";
import { requireEnv } from "../../scripts/seed-users.mts";

// Reads Activity Log events for assertions until the Activity screen exists.

function connect() {
  return postgres(requireEnv("DIRECT_DATABASE_URL"), {
    prepare: false,
    max: 1,
  });
}

// Take this before acting, then read the events that came after it.
export async function lastActivityId(): Promise<number> {
  const sql = connect();
  try {
    const [row] = await sql<{ id: number }[]>`
      select coalesce(max(id), 0)::int as id from activity_log`;
    return row!.id;
  } finally {
    await sql.end();
  }
}

export async function eventsAfter(
  afterId: number,
  filter: { userName: string } | { email: string },
): Promise<string[]> {
  const sql = connect();
  try {
    const rows = await sql<{ action: string }[]>`
      select action from activity_log
      where kind = 'event' and id > ${afterId}
        and ${
          "userName" in filter
            ? sql`user_name = ${filter.userName}`
            : sql`details ->> 'email' = ${filter.email}`
        }
      order by id`;
    return rows.map((row) => row.action);
  } finally {
    await sql.end();
  }
}

export type LogRow = { action: string; entityLabel: string; userName: string };

// Every row (data and event) after the given id.
export async function activityAfter(afterId: number): Promise<LogRow[]> {
  const sql = connect();
  try {
    return await sql<LogRow[]>`
      select action, entity_label as "entityLabel", user_name as "userName"
      from activity_log where id > ${afterId} order by id`;
  } finally {
    await sql.end();
  }
}
