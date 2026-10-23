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
| `pnpm test:e2e` | Playwright, desktop + phone (`e2e/`). First run: `pnpm exec playwright install chromium` |
| `pnpm format` | Prettier (with Tailwind class sorting) |
| `pnpm build` | Production build |
