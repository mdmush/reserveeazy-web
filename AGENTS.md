<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Credit-engine invariants (do not break these)

The membership build (classes, credits, attendance, commission) lives behind
SECURITY DEFINER RPCs in `supabase/migrations/` — never write to its tables
directly from the app:

- `credit_transactions` and `commission_events` are **append-only** (no write
  policies exist). Corrections are compensating rows, never UPDATE/DELETE.
  Balances are always derived (`package_instance_balances` view), never stored.
- Cost rule: a class costs **1 credit from a locked package**, or the class
  type's `credit_cost` from a flexible tier. Deduction order is locked-first,
  then soonest expiry, then oldest purchase; refunds return to the source
  instance. `src/lib/credit-engine.ts` mirrors this math for UI previews and
  unit tests — if it disagrees with the SQL, the SQL wins.
- Activation: validity starts at first attendance; a late-cancel or no-show of
  an unactivated package also starts it (anti-parking). One-shot, in
  `_activate_instance`.
- Seat changes (`book_class`, `cancel_booking`, waitlist RPCs) serialize on
  `SELECT … FOR UPDATE` of the `class_sessions` row. Members are never
  auto-booked from the waitlist — offers reserve the seat, admins claim.
- Receipt numbers come from `receipt_counters` inside the payment RPCs —
  gapless per business; never insert into `payments` any other way.
- Every new table gets `business_id` + membership-scoped RLS + a superuser
  SELECT overlay. UI gates on `getCapabilities(pricing_mode)`, never on the
  mode string.
- Tests: `npm run seed:uat && npm run tenancy-test && npm run engine-test &&
  npm run test:unit` — extend `scripts/engine-test.mjs` when touching engine
  rules; it asserts the invariants above against the live DB.
