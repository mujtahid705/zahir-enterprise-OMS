// DB tests run against the live project (ADR 0002). Refuse to start unless
// DATABASE_URL points at the project named by SUPABASE_PROJECT_REF, so a stray
// URL can never receive test traffic.
export function assertDatabaseMatchesProject(
  databaseUrl: string | undefined,
  projectRef: string | undefined,
): void {
  if (!databaseUrl) throw new Error("DB tests need DATABASE_URL.");
  if (!projectRef) throw new Error("DB tests need SUPABASE_PROJECT_REF.");

  const url = new URL(databaseUrl);
  // Pooler: user `postgres.<ref>`. Direct: host `db.<ref>.supabase.co`.
  const matches =
    url.username.endsWith(`.${projectRef}`) ||
    url.hostname === `db.${projectRef}.supabase.co`;

  if (!matches) {
    throw new Error(
      `DATABASE_URL (${url.username}@${url.hostname}) does not match SUPABASE_PROJECT_REF; refusing to run DB tests.`,
    );
  }
}
