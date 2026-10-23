# ZE Order & Billing System

Spec: `SPEC.md`. Domain terms: `GLOSSARY.md`. Decisions: `docs/adr/`. Look and feel: `docs/DESIGN.md`. Logo assets: `brand/` (copies served from `public/brand/`).

## Code

- Next.js 16 with Cache Components (see `AGENTS.md`): read the bundled docs in `node_modules/next/dist/docs/` before writing Next.js code.
- Colours, radii and type come from the tokens in `src/app/globals.css`, which mirror `docs/DESIGN.md`. Use token classes (`bg-navy`, `text-ink-muted`, `section-label`, `num`), never raw hex.
- Navigation and role visibility live in `src/lib/nav.ts`.
- `PLACEHOLDER_USER` stands in for the signed-in user until auth lands.
- Before committing run `pnpm check`; run `pnpm test:e2e` when UI changes.

## Agent skills

### Issue tracker

Issues live in GitHub Issues on `mujtahid705/zahir-enterprise-OMS`, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `GLOSSARY.md` + `docs/adr/`. See `docs/agents/domain.md`.
