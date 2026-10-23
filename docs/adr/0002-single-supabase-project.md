# One Supabase project for development and production

We use a single hosted Supabase project, "Zahir Enterprise" (`ejsnnxkqxiuyouxewpzi`, Singapore `ap-southeast-1`), for local development, tests, previews and production. This replaces the original `ze-dev` / `ze-prod` pair in Mumbai. ZE is one small office with a handful of users, and a second project is one more set of keys, migrations and settings to keep in step. We accept that work on the app now touches live data.

## Consequences

- There is no separate dev database. Migrations apply straight to the live database, so review each one before running it, and prefer additive changes.
- Database tests must leave no trace: each one runs in a transaction that is always rolled back. Commit-then-delete is not an option, because Activity Log rows can never be deleted and committed test orders would use up real order numbers. The guard still checks that `DATABASE_URL` matches `SUPABASE_PROJECT_REF`, so tests can't hit a stray project, but it no longer separates test data from real data.
- E2E seeded test users and their orders live alongside real ones, marked (e.g. `@test.ze` emails). E2E runs before go-live only; a one-time pre-launch reset (system actor, the only deliberate bypass of Activity Log immutability) then clears test data, sequences and the log. After launch, E2E doesn't write to the live project.
- Vercel functions should run in `sin1`, next to the database, not `bom1`.
- Revisit if ZE grows or the first bad migration hurts: Supabase branching or a second project can be added later without changing app code, since everything reads from env vars.
