# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Render OS — a private, mobile-first internal operations tool for **Render Exteriors**, a soft-wash / exterior cleaning business in Vancouver, BC. Solo-operator use, not a public SaaS. It manages quoting and client records, and uses the Claude API to generate judgment-based price quotes.

## Commands

Node is managed via **nvm** — if `node` is "command not found", run `source ~/.nvm/nvm.sh` (or open a new terminal) first.

```bash
npm run dev      # dev server at http://localhost:3000 (Turbopack off)
npm run build    # production build — run this to typecheck the whole app
npm run start    # serve the production build
npm run lint     # ESLint (eslint-config-next, flat config in eslint.config.mjs)
```

There is no test runner configured. `npm run build` is the de facto typecheck/CI gate.

## Stack & important version notes

- **Next.js 16**, App Router, TypeScript, no `src/` dir. (The original brief said Next 14; scaffolding installed 16 — the App Router model is the same.)
- **`params` is a `Promise`** in dynamic routes — always `await params` (see `app/clients/[id]/page.tsx`). This is a Next 15/16 change from older training data.
- **Read `AGENTS.md`** — it flags that this Next.js has breaking changes vs. older docs and points at `node_modules/next/dist/docs/` for the authoritative guides. Check those before using an API you're unsure about.
- **Tailwind v4** — there is no `tailwind.config.js`. Theme tokens (brand colors, fonts) are defined in `app/globals.css` under `@theme`. Add new design tokens there, then use them as utilities (`bg-charcoal`, `text-cream`, `bg-forest`, `bg-card`, `font-serif`).
- **Supabase** (`@supabase/supabase-js`) for Postgres; **Anthropic SDK** (`@anthropic-ai/sdk`) for quote generation. Target deploy is Vercel.

## Environment

Copy `.env.local.example` → `.env.local`. Three vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY` (server-only — never `NEXT_PUBLIC_`). The app runs without them: Supabase-backed pages render a "connect Supabase" empty state, and the quote API returns an error until `ANTHROPIC_API_KEY` is set.

## Architecture

Data flows through two external services, each isolated to one module:

- **`lib/supabase.ts`** — the single Supabase client, memoized via `getSupabase()`. Returns `null` when env vars are absent so Server Components can degrade gracefully instead of throwing. Every page that reads data calls `getSupabase()` and branches on `null`.
- **`lib/anthropic.ts`** — owns the Claude client, the pricing system prompt, and `generateQuote()`. The pricing rules (regional premiums, material complexity, moss, estate floor, $200 minimum) live in `SYSTEM_PROMPT` here. Output is constrained with structured outputs (`output_config.format` JSON schema) so the response parses deterministically. Model: `claude-sonnet-4-6`.
- **`app/api/quote/route.ts`** — the **only** caller of `lib/anthropic.ts`. Convention: all Claude API calls go through this route. `QuoteForm` (a Client Component) POSTs the form fields here; everything else is Server Components.

`lib/types.ts` is the single source of truth for both the domain types (`Client`, `Job`, `JobStatus`, …, mirroring `supabase/schema.sql`) and the quote-form option sets (`SERVICES`, `SIZES`, `MATERIALS`, …) — the form and the schema both import from here, so changing an option set is a one-line edit.

Routes (App Router):
- `app/(dashboard)/page.tsx` → `/` — summary stats (route group adds no path segment).
- `app/quotes/page.tsx` → `/quotes` — renders `QuoteForm`.
- `app/clients/page.tsx` and `app/clients/[id]/page.tsx` — client list / detail.

Pages that hit Supabase set `export const dynamic = "force-dynamic"` so they aren't statically prerendered at build time (when no DB is reachable).

## Conventions

- **Server Components by default**; add `"use client"` only when you need interactivity (`QuoteForm` is the only client component so far).
- **Status badge colors** (`components/StatusBadge.tsx`): green=Paid, amber=Invoiced/Accepted, red=Declined, grey=Quoted, blue=Completed.
- **Brand / design**: dark mode default — charcoal `#1C1C1C` bg, cream `#F5F0E8` text, forest-green `#2D5016` accent, warm off-white `#E8E0D0` cards. Headings use DM Serif Display (`font-serif`), body uses DM Sans (`font-sans`), both wired in `app/layout.tsx` via `next/font`. Sharp corners, minimal chrome, premium feel — avoid rounded utilities.
- **Database changes** go in `supabase/schema.sql` and the matching types in `lib/types.ts` together.

## Build status (from the original brief)

Done: project init, schema, quote form UI, Claude API route, quote result card, client list + detail, dashboard stats. Not yet built: saving a client/job record from a quote, job notes editing UI, photo upload (`job_photos` table exists), and broader mobile polish.
