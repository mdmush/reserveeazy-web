@AGENTS.md

# CUSP — studio booking & membership platform

This repo is the **product app** served at `app.cusp.my` (Vercel project
`reserveeazy-web`). The marketing site is a **separate repo** at
`https://www.cusp.my` — nothing marketing belongs here. The product was
renamed ReserveEazy → CUSP in Aug 2026; the rename is presentation-layer only
(DB tables still say `business`).

Two products share one codebase, selected per studio by
`businesses.pricing_mode`:

- **`simple`** (mode A): appointment booking — services, staff, calendar,
  public `/book/[slug]` page, embeddable widget. The original build.
- **`pay_per_class` / `credits`** (modes B/C): the membership build — group
  classes, credit packages, attendance, teacher commission, waivers, waitlist.
  Spec: `audrey-booking-functional-spec.md` + `FSD-v0.6-delta.md` (repo root,
  untracked on purpose).

Deep dives: [docs/architecture.md](docs/architecture.md) (tenancy, RLS, the
credit engine, auth/roles) and [docs/structure.md](docs/structure.md) (routes,
directories, where things live).

## Stack

Next.js 16 App Router (customized — see AGENTS.md warning) · React 19 ·
Supabase (Postgres 17, auth, RLS) · Tailwind v4 + shadcn-style components ·
react-hook-form + zod · date-fns + date-fns-tz. Hand-written DB types in
`src/types/database.ts` (no codegen — update it with every migration).

## Commands

```bash
npm run dev            # local dev (Turbopack; stale-CSS fix: rm -rf .next)
npm run build          # must stay green after every change
npm run lint           # baseline: 3 pre-existing errors (calendar-view ×2, ui/select ×1)
npm run db:push        # apply supabase/migrations to the linked project
npm run smoke-test     # anon posture: every table empty for anon, RPCs sealed
npm run seed:uat       # two UAT studios (A=simple, B=credits); -- --cleanup removes
npm run tenancy-test   # cross-tenant isolation (run seed:uat first)
npm run engine-test    # credit-engine rules against the live DB (seed first)
npm run test:unit      # node --test for the TS engine mirror
```

New migrations: `npx supabase migration new <name>` — never hand-name files.
Secrets live in `.env.local` (never commit): Supabase URL + anon key,
`SUPABASE_SERVICE_ROLE_KEY` (seeds/tests only).

## Hard rules

- **Engine tables are RPC-only.** Never insert/update `bookings`,
  `credit_transactions`, `payments`, `package_instances`, `commission_events`,
  `payment_dues`, `grace_passes`, `waiver_acceptances` from the app — call the
  SECURITY DEFINER RPCs. Full invariants list in AGENTS.md.
- **Gate UI on capabilities, not mode strings**:
  `getCapabilities(business.pricing_mode)` from `src/lib/pricing-mode.ts`.
- **Every new table**: `business_id` + membership-scoped RLS + superuser
  SELECT overlay, and add it to the smoke/tenancy test lists.
- **Server actions**: zod-parse → `requireMembership()` /
  `requireAdminMembership()` (`src/lib/business.ts`) → scope by
  `membership.business_id` → `revalidatePath`. Pattern: `src/actions/dashboard.ts`.
- **Time**: store UTC instants; do day/month math in `business.timezone` via
  `date-fns-tz` (pattern: `src/app/dashboard/reports/page.tsx`). Money is
  integer cents (MYR display via `formatPrice(cents, "MYR")`).
- **Do not touch** `/login` and `/signup` paths (the marketing site links to
  them absolutely) or the widget's `cusp-*` DOM ids (embed contract).
- SEO: root layout is noindex-by-default; only `/book/[slug]` opts back in.
  No blanket `Disallow: /` in `robots.ts`.

## Deploy

Push to `main` ⇒ Vercel deploys. **Apply migrations before pushing code that
depends on them** (`npm run db:push`) — the DB and deployed code must move
together. The Supabase project (ref `terktsddtkazlyxgdzdz`) pauses on free-tier
idle: a Cloudflare 521 means paused, not deleted.

Brand: canonical SVGs in `public/brand/` (source of truth: cusp.my/brand).
Gradient `#e11d34 → #fb4d4d → #fb6a4a → #f5a524`. `BrandLogo`
(`src/components/brand/logo.tsx`) inlines the lockup; use `variant="onBrand"`
on gradient surfaces.
