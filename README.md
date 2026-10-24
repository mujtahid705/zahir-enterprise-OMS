# zahir-enterprise-OMS

Order & Billing System for Zahir Enterprise.

- [SPEC.md](SPEC.md) — full specification
- [GLOSSARY.md](GLOSSARY.md) — domain terms
- [docs/adr/](docs/adr/) — architecture decisions
- [docs/DESIGN.md](docs/DESIGN.md) — look and feel

## Develop

Requires Node 24+ (`.nvmrc`) and pnpm.

```sh
pnpm install
scripts/setup-supabase.sh   # walks you through the Supabase project and fills .env.local
pnpm dev
```

| Command | What |
|---|---|
| `pnpm check` | Lint, typecheck, format check, unit tests |
| `pnpm test` | Vitest unit tests (`src/**/*.test.ts`) |
| `pnpm test:db` | Vitest DB tests (`src/**/*.db.test.ts`) against the live project, each rolled back |
| `pnpm test:e2e` | Playwright, desktop + phone (`e2e/`). Seeds `@test.ze` Users with `E2E_PASSWORD`; pre-launch only (ADR 0002). First run: `pnpm exec playwright install chromium` |
| `pnpm db:generate` / `pnpm db:migrate` | Generate / apply Drizzle migrations (`src/db/migrations/`). Applies to the live database: review first |
| `pnpm db:seed-admin` | Create the first Admin (below) |
| `pnpm format` | Prettier (with Tailwind class sorting) |
| `pnpm build` | Production build |

## First Admin

There is no sign-up: the first Admin is seeded once, then creates everyone else in the app. Pass the credentials on the command line so they are never stored in a file:

```sh
SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_NAME="Your Name" SEED_ADMIN_PASSWORD='…' pnpm db:seed-admin
```

The profile is written as the system actor. Running it again for the same email does nothing. Change the password after first sign-in.

Password reset emails need the Reset Password template from `scripts/setup-supabase.sh` (step 5). Supabase's built-in email only reaches your Supabase team's addresses until custom SMTP is set up (#20).
