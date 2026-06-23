# Render OS

Internal operations tool for **Render Exteriors** (Vancouver, BC) — quoting and client records for a soft-wash / exterior cleaning business. Next.js 16 · Supabase · Anthropic Claude · Tailwind v4.

## Setup

1. **Node** is managed with [nvm](https://github.com/nvm-sh/nvm). In a new terminal Node should be on your `PATH`; if `node` is not found, run `source ~/.nvm/nvm.sh`.

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment** — copy the example and fill in your keys:
   ```bash
   cp .env.local.example .env.local
   ```
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from your Supabase project (Settings → API).
   - `ANTHROPIC_API_KEY` — from <https://console.anthropic.com/>.

   The app boots without these; the quote generator needs the Anthropic key, and client/dashboard pages need Supabase.

4. **Database** — in the Supabase SQL editor, run the contents of [`supabase/schema.sql`](supabase/schema.sql).

5. **Run**
   ```bash
   npm run dev
   ```
   Open <http://localhost:3000>.

## Project layout

```
app/
  (dashboard)/page.tsx     summary stats           → /
  quotes/page.tsx          new quote form          → /quotes
  clients/page.tsx         client list             → /clients
  clients/[id]/page.tsx    client detail           → /clients/:id
  api/quote/route.ts       Claude quote generation (the only Claude caller)
components/                QuoteForm, ClientCard, JobHistory, StatusBadge
lib/                       supabase.ts, anthropic.ts, types.ts
supabase/schema.sql        Postgres schema
```

See [`CLAUDE.md`](CLAUDE.md) for architecture and conventions.

## Deploy

Deploys to [Vercel](https://vercel.com). Set the three environment variables in the Vercel project settings; `npm run build` is the build command.
