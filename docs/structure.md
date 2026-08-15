# CUSP — Repo Structure

Where things live and the conventions each area follows. For how the system
works, see [architecture.md](architecture.md).

## Top level

```
CLAUDE.md / AGENTS.md      agent briefs (AGENTS.md holds the engine invariants)
docs/                      this documentation
middleware.ts              route guards (auth/role redirects; UX, not security)
next.config.ts             embed CSP header (frame-ancestors * for /embed)
public/
  brand/                   canonical CUSP SVGs (source: cusp.my/brand)
  widget.js                embeddable booking widget (ES5 IIFE, cusp-* DOM ids)
scripts/                   node scripts: seeds + live-DB test suites
src/                       the app
supabase/migrations/       schema history — the only way schema changes ship
audrey-booking-functional-spec.md, FSD-v0.6-delta.md,
mush-brief-cusp-rebrand-2026-08-12.md
                           product specs (kept untracked deliberately)
```

## Routes (`src/app/`)

| Route | Access | Purpose |
|---|---|---|
| `/` | public | redirects to `/login` |
| `/login`, `/signup` | public | auth (paths are frozen — marketing links to them); `/signup?email=…` pre-fills teacher invites |
| `/auth/confirm` | public | Supabase code exchange (only route handler) |
| `/onboarding` | authed, no membership | creates a business via the `create_business` RPC |
| `/book/[slug]` | public, **indexable** | per-studio booking page (reads via RPC only) |
| `/embed/[token]` (+ `/embed-demo`) | public iframe | widget booking surface, domain-allowlisted |
| `/dashboard` | owner/admin | overview + "Waiting on you" notifications card |
| `/dashboard/calendar,services,staff,clients[,id],widgets,settings` | owner/admin | mode-A admin (staff page also hosts commission rates) |
| `/dashboard/classes` | capability: attendance | class types = the credit-cost table |
| `/dashboard/schedule[,sessionId]` | capability: attendance | week schedule; roster = booking, attendance, waitlist panel |
| `/dashboard/packages` | capability: credits | package CRUD + sell-package (payment + receipt) |
| `/dashboard/receipts[,id]` | capability: attendance | receipt list + printable receipt |
| `/dashboard/waivers` | capability: attendance | versioned waiver editor/publish |
| `/dashboard/reports` | all | mode-aware monthly reports + CSV |
| `/teach[,sessionId]` | role: staff | teacher portal — own sessions, attendance-only roster |
| `/admin/**` | superuser | cross-tenant platform views |
| `robots.ts`, `icon.svg`, `apple-icon.png` | — | SEO + favicons (noindex default; `/book` opts in) |

Every page is a server component that fetches with the user's Supabase client
and passes plain props to client components. `params`/`searchParams` are
Promises (Next 16) — always `await` them.

## Server actions (`src/actions/`)

`"use server"` modules; the only mutation path from the UI. Convention:
zod-parse → `requireMembership()`/`requireAdminMembership()` → query scoped by
`membership.business_id` (or call an RPC) → `revalidatePath`.

| File | Owns |
|---|---|
| `auth.ts` | login/signup/logout, onboarding (→ `create_business` RPC) |
| `dashboard.ts` | mode-A CRUD: services, staff, availability, hours, clients, appointments, settings (incl. `pricing_mode` with server-side availability guard) |
| `classes.ts` | class types CRUD, session create (weekly recurrence = atomic batch insert), session cancel (single/future) |
| `engine.ts` | thin wrappers over every engine RPC: book/cancel, attendance ± revert, packages/sell/adjust, passes, waitlist offer/claim/release, dues, commission rates |
| `waivers.ts` | waiver versions (draft/publish), acceptance (→ RPC), guardian links |
| `widgets.ts`, `admin.ts` | embed widgets; superuser cross-tenant reads |

`markAttendanceAction` is the one non-admin action (teachers may call it — the
RPC enforces own-session-only).

## Lib (`src/lib/`)

| File | Purpose |
|---|---|
| `business.ts` | `getUserMembership` (one-business-per-user), `requireMembership`, `requireAdminMembership` |
| `pricing-mode.ts` | mode labels/availability + `getCapabilities()` — the only gating source |
| `credit-engine.ts` (+ `.test.ts`) | pure-TS mirror of deduction/cost/claim-window math (SQL is authoritative) |
| `whatsapp.ts` | `waLink()` + the 7 admin-tap message templates (MY number normalization) |
| `payments.ts` | payment-method labels |
| `clock.ts` | `nowMs`/`isoOffsetFromNow` — keeps `Date.now()` out of component bodies (React purity lint) |
| `booking/` | mode-A slot math (`slots.ts`) + public-page loader over the RPC |
| `supabase/` | server/client/middleware Supabase factories (`@supabase/ssr`) |
| `validations/` | all zod schemas + inferred input types |
| `superuser.ts` | superuser checks + post-auth routing (staff → `/teach`) |
| `csv.ts`, `format.ts`, `constants.ts`, `calendar/`, `app-url.ts`, `utils.ts` | small utilities |

`src/types/database.ts` — hand-written Supabase types: every table, view, and
RPC. **Update it in the same change as any migration.** RPC-only tables use
`Insert/Update: Record<string, never>`; views need `Relationships: []` (a
missing one collapses all client types to `never`).

## Components (`src/components/`)

| Dir | Contents |
|---|---|
| `brand/` | `BrandLogo` (inline canonical lockup; `variant="onBrand"` on gradient), `AuthShell` |
| `shell/` | `AppSidebar`/`AppMobileNav`, `StatCard` — shared dashboard/admin chrome |
| `dashboard/` | mode-A managers (services/staff/clients/widgets/settings), `sidebar.tsx` (capability-gated nav), `PageHeader`, empty states |
| `classes/` | schedule manager + session form, `session-roster.tsx` (booking w/ cost preview, attendance, waitlist panel; `mode="teacher"` strips admin controls), commission-rates dialog, pending-notifications card |
| `packages/` | packages manager + sell dialog, member panel (balances/ledger/passes/waiver/family tabs), printable receipt bits |
| `waivers/` | version list/editor/publish |
| `reports/` | instructor-hours, commission report, member sessions, CSV export button |
| `booking/`, `calendar/`, `admin/`, `auth/`, `theme/` | public booking widget UI, calendar view, superuser pages, auth forms, theming |
| `ui/` | shadcn-style primitives (button, dialog, table, tabs, select, …) |

Supabase joins aren't typed (hand-written types have empty `Relationships`) —
cast joined rows `as unknown as <shape>` like the existing pages do.

## Scripts (`scripts/`)

| Script | npm run | Notes |
|---|---|---|
| `seed-two-studios.mjs` | `seed:uat` | Studio A (simple) + B (credits, classes/sessions); identical names/emails across studios by design; `-- --cleanup` |
| `smoke-test.mjs` | `smoke-test` | anon posture + RPC existence + engine RPCs sealed |
| `tenancy-test.mjs` | `tenancy-test` | cross-tenant isolation, both directions, every table |
| `engine-test.mjs` | `engine-test` | ~45 live-DB checks of every engine rule; resets studio B's engine rows first |
| `setup-auth.mjs` | `setup:auth` | prints the Supabase auth config checklist |

Seeds/tests need `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. UAT credentials
live inside the seed script.

## Migrations (`supabase/migrations/`)

Ordered history; create with `npx supabase migration new <name>`, apply with
`npm run db:push`. Eras:

1. **2026-05-24/25** — mode-A core: tables, RLS + helpers
   (`get_user_business_ids`, `is_business_admin`, `is_superuser`), superuser
   overlay, widgets, business hours.
2. **2026-08-13 (foundation)** — `pricing_mode`, `get_public_booking_context`
   RPC, `lock_public_read_policies` (dropped all `USING (true)` policies;
   added `create_business`).
3. **2026-08-13 (membership)** — `classes_core`, `credit_engine_core`,
   `bookings_engine`, `attendance_commission`, `teacher_invite_link`
   (+ `fix_invite_link_guard`), `grace_passes`, `waivers_family`,
   `waitlist_admin_flow`. Later migrations redefine earlier RPCs
   (`grace_passes` redefines `book_class`) — always read the newest definition.

The remote migration ledger was repaired on 2026-08-14; `db push` works
normally. Never edit an applied migration — add a new one.
