# CUSP — Architecture

How the system is designed and why. For where files live, see
[structure.md](structure.md).

## Topology

```
www.cusp.my   ── marketing site (separate repo)
app.cusp.my   ── this app (Vercel project reserveeazy-web, deploys on push to main)
Supabase      ── one shared project (ref terktsddtkazlyxgdzdz): Postgres 17,
                 auth, RLS. One project serves ALL studios — no per-studio
                 deployments (that would break the unit economics).
```

`/` redirects to `/login`. `/login` and `/signup` are permanent URLs — the
marketing site links to them absolutely.

## Multi-tenancy

The tenant is a **business** (`businesses` table; "studio" in product language
— never renamed in the DB). `business_id` is on every tenant-owned table.
Isolation is enforced in layers:

1. **RLS** — membership-scoped policies via `get_user_business_ids()`
   (SECURITY DEFINER helper). No table is world-readable; anonymous clients
   get zero rows everywhere.
2. **RPC body checks** — every engine function resolves the row's
   `business_id` and asserts `is_business_admin()` (or the teacher rule) before
   acting.
3. **App-level scoping** — server actions additionally filter by
   `membership.business_id` (defense in depth, not the security boundary).
4. **Superuser overlay** — additive `FOR SELECT USING (is_superuser())`
   policies give the platform operator (`profiles.is_superuser`) read access
   for `/admin`.

One deliberate simplification: **one business per user**
(`getUserMembership()` takes the oldest membership). A tenant switcher is
explicitly deferred.

The acceptance test for all of this is automated: `scripts/tenancy-test.mjs`
seeds two studios with identical class names and member emails and asserts no
query, report, or export leaks a row across them.

## Pricing modes and capability gating

`businesses.pricing_mode` ∈ `simple | pay_per_class | credits` (CHECK
constraint, default `simple`). Modes are **configuration, not code branches**:
`src/lib/pricing-mode.ts` maps each mode to capabilities
`{ attendance, credits, commission }` and all UI/nav/report gating reads those
capabilities, never the mode string.

- **simple** — appointments only (services × staff × time slots, GiST
  exclusion constraint forbids overlapping appointments per staff member).
- **pay_per_class** — classes + attendance + commission; each attendance
  creates a `payment_dues` line at the class type's drop-in price.
- **credits** — everything above plus the credit-package engine.

The two models coexist: appointments were never retrofitted for classes.
Group classes are a parallel schema (`class_types`, `class_sessions`,
`bookings`) that simple-mode studios never see.

## Public booking surface (mode A)

Anonymous visitors read **only** through SECURITY DEFINER RPCs — there are no
anon table grants:

- `get_public_booking_context(slug)` → business + active services + bookable
  staff (emails nulled) + hours/availability/time-off + busy windows (no
  client PII). Feeds `/book/[slug]` and `/embed/[token]`.
- `create_public_booking(...)` → validates hours, notice windows, and overlap
  server-side, then upserts the client and books.
- `get_embed_widget_context(token)` → widget config for the embeddable
  `public/widget.js` (ES5 IIFE; `cusp-*` DOM ids are the embed contract).

Slot generation happens in TS (`src/lib/booking/slots.ts`) from the RPC data.

## The credit engine (modes B/C)

All mutations live in SECURITY DEFINER Postgres functions (auth checks in the
body, `search_path = public`, EXECUTE granted to `authenticated` only). The
app calls them via thin server actions in `src/actions/engine.ts`.

**Data model** (`supabase/migrations/202608131631…` onward):

- `class_types` — name, defaults, `credit_cost` (the admin-maintained
  credit-cost table), `drop_in_price_cents` (mode-B dues).
- `class_sessions` — teacher, time range, capacity; teacher no-double-book via
  GiST exclusion; recurrence = materialized rows sharing a
  `recurrence_group_id` (no recurrence engine).
- `packages` → `package_instances` — products vs sold copies. Instances
  snapshot scope/credits/validity at sale so product edits never rewrite sold
  packages. `scope` is `locked` (one class type) or `flexible` (any).
- `credit_transactions` — **append-only ledger** (zero write policies).
  Balances are always derived (`package_instance_balances` view). Every
  deduction stores a `cost_snapshot`.
- `bookings` — status enum `booked | waitlisted | offered | cancelled_early |
  cancelled_late | attended | no_show | pass_makeup`; partial unique index =
  one live booking per member per session.
- `commission_rates` / `commission_events` — per-teacher (optionally
  per-class-type) RM-per-head rates; events snapshot the rate at attendance
  and are append-only (reversals are compensating negative rows). Teachers can
  read only their own rates/events.
- `payments` + `receipt_counters` — gapless per-business receipt numbers from
  a row-locked counter (transactional, e-invoice-friendly), written only
  inside `assign_package` / `record_due_payment`.
- `grace_passes`, `waiver_versions` / `waiver_acceptances`, family links
  (`clients.guardian_client_id`, same-tenant composite FK, one level deep).

**Rules the engine enforces** (spec: `audrey-booking-functional-spec.md`; each
has a live-DB test in `scripts/engine-test.mjs`):

- Cost: locked package pays **1 credit/class**; flexible pays the class
  type's `credit_cost`.
- Deduction order: locked-first → soonest expiry → oldest purchase; refunds
  always return to the source instance.
- Activation: validity starts at **first attendance**; a late-cancel or
  no-show of an unactivated package also starts it (anti-parking). One-shot,
  in `_activate_instance`.
- Cancellation: ≥ cutoff (default 24h, `businesses.settings`) refunds; inside
  it forfeits. Admin `force_refund` override is ledgered.
- Capacity & concurrency: seat-changing RPCs serialize on
  `SELECT … FOR UPDATE` of the session row; `offered` holds a seat.
- Waitlist: freed seats are **offered** with a claim window (default 120 min,
  shrunk so it never crosses the cancellation cutoff); members are never
  auto-booked; deduction happens at claim, not at waitlisting.
- Grace passes: admin-granted with a mandatory reason, redeemable only for a
  **different** class type than the missed one, never create credits.
- Waivers: once a version is published, `book_class` requires acceptance of
  the **current** version; republishing forces re-acceptance; guardians accept
  for dependents.
- Family: credits are never shared — a guardian's packages cannot fund a
  dependent's class.

`src/lib/credit-engine.ts` mirrors the cost/ordering/claim-window math in pure
TS for UI previews and `node --test` units. **If it disagrees with the SQL,
the SQL wins.**

## Auth, roles, and surfaces

Supabase email+password; SSR cookie sessions (`@supabase/ssr`);
`middleware.ts` guards routes (UX only — RLS/RPCs are the security).

| Role | Where it lives | Surface |
|---|---|---|
| owner / admin | `business_members.role` | `/dashboard/**` (full studio admin) |
| staff (= teacher) | `business_members.role` | `/teach` only — own sessions, roster, attendance |
| superuser | `profiles.is_superuser` | `/admin` (cross-tenant, read-heavy) |
| member/customer | `clients` rows — **no login** | booked by admin / public page |

Teacher invites: admin sets an email on the staff row and shares
`/signup?email=…`; the `handle_new_user()` trigger links the new auth user to
waiting staff rows on signup (at most one per business; linking errors never
block signup). Post-auth routing sends `staff` to `/teach`; the dashboard
layout redirects them away from admin surfaces; `mark_attendance` enforces
own-session-only regardless of UI.

## Notifications (v1: admin-tap)

No messaging API. Every event (booking/cancel confirmations, reminders,
waitlist offers, expiry warnings, activation, pass granted) is a pre-filled
`wa.me` link (`src/lib/whatsapp.ts`) surfaced where the event happens, plus a
"Waiting on you" card on the overview (pending offers, tomorrow's classes,
expiring packages). Phase 2 upgrades the same templates to the WhatsApp Cloud
API.

## Reports

`/dashboard/reports`, month-scoped in the **studio timezone**:

- simple mode: instructor hours + member sessions derived from
  confirmed/completed appointments.
- membership modes: commission report (classes taught, attended headcount,
  hours, RM from rate-snapshot sums — reversals net out) and attendance-based
  member sessions (+ outstanding dues column in mode B). CSV export
  client-side (`src/lib/csv.ts`).

## Testing strategy

Four suites, all against the **live** database using two seeded UAT studios:

1. `smoke-test` — anon can read nothing, engine RPCs sealed, public RPCs exist.
2. `tenancy-test` — the FSD §1 cross-tenant isolation UAT, both directions.
3. `engine-test` — every credit-engine rule end-to-end through the RPCs as a
   real studio owner (receipts, deduction order, activation, waitlist windows,
   passes, waivers, teacher permissions, cross-tenant rejections).
4. `test:unit` — pure-TS mirror math (boundary cases: exact-24h cutoff,
   window shrink).

Seeds are idempotent; `npm run seed:uat -- --cleanup` removes the UAT studios.

## Explicitly deferred

Member self-serve portal (customer logins), WhatsApp Cloud API automation,
payment gateway (studio-owned merchant of record — CUSP must never take
custody of funds), payroll computation, promo/marketing, multi-studio operator
switcher, EU-region tenant (GDPR question owned by Carl), MyInvois.
