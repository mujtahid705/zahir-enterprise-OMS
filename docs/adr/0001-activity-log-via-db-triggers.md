# Activity Log captured by database triggers, not app code

ZE's Admin needs a complete record of every change any User makes. We capture data changes with a Postgres `AFTER` trigger on every table, which writes a field-level before/after diff to an append-only `activity_log`. The app only sets `app.user_id` / `app.user_name` per transaction (`withUser`) and writes events that aren't table writes (login, download, share, unlock reason). We chose this over logging inside each Server Action because an app-level log is only as complete as the developer's memory: one forgotten call in a future action leaves a silent hole, while a trigger can't be skipped. The trigger also raises an error when no user is set, so an un-wrapped write fails loudly instead of going unattributed.

## Consequences

- Every write must go through `withUser`; bare Drizzle writes outside it fail by design. Migrations and seeds set `app.actor = 'system'`.
- `set_config(…, true)` is transaction-local, which keeps it safe with the Supabase transaction pooler. A write outside an explicit transaction would lose the setting, which is one more reason everything goes through `withUser`.
- Trigger rows are per table row. The UI groups them into one entry per save using `tx_id`.
- Log rows are immutable: a `BEFORE UPDATE OR DELETE` trigger raises, and the app role has no `UPDATE`/`DELETE`/`TRUNCATE` on the table.
