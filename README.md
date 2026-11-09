# Askwell

An AI support chat widget for any website. See `docs/project.md` for what we build and `docs/plan.md` for the build order.

## Setup

Needs Node 24 (`.nvmrc`) and pnpm 10.

```sh
pnpm install
cp .env.example .env
pnpm dev
```

Every PR gets a Vercel preview deployment; its URL is on the PR.

## Commands

| Command | Does |
| --- | --- |
| `pnpm dev` | Runs the app and rebuilds the widget on change |
| `pnpm typecheck` | Type-checks every package |
| `pnpm lint` | Lints every package |
| `pnpm test` | Runs the Vitest tests |
| `pnpm build` | Builds every package |

## Layout

| Path | Holds |
| --- | --- |
| `apps/web` | Next.js app |
| `apps/widget` | Vanilla TypeScript loader, bundled to `dist/widget.js` |
| `packages/shared` | Code shared across the apps |
| `packages/db` | Database package |
