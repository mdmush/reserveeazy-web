#!/usr/bin/env node
/**
 * Automated smoke test for CUSP MVP infrastructure.
 * Run: npm run smoke-test
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  const content = readFileSync(envPath, "utf8");
  const env = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [key, ...rest] = trimmed.split("=");
    env[key] = rest.join("=");
  }
  return env;
}

// Since the lock_public_read_policies migration, NO table is anon-readable:
// public booking pages read through the get_public_booking_context RPC.
const AUTH_ONLY_TABLES = [
  "profiles",
  "businesses",
  "business_members",
  "services",
  "staff_services",
  "staff_availability",
  "staff_time_off",
  "business_hours",
  "clients",
  "appointments",
  "booking_widgets",
  "class_types",
  "class_sessions",
  "packages",
  "package_instances",
  "credit_transactions",
  "payments",
  "bookings",
  "grace_passes",
  "commission_rates",
  "commission_events",
  "payment_dues",
  "waiver_versions",
  "waiver_acceptances",
];

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.error("FAIL: Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
    process.exit(1);
  }

  console.log("CUSP smoke test\n");
  console.log(`Supabase URL: ${url}`);

  const supabase = createClient(url, anonKey);

  // 1. Auth health
  const { error: authError } = await supabase.auth.getSession();
  if (authError) {
    console.error("FAIL: Auth connection:", authError.message);
    process.exit(1);
  }
  console.log("PASS: Supabase auth reachable");

  // 2. Every table must return zero rows for anon (not error)
  for (const table of AUTH_ONLY_TABLES) {
    const { error, count } = await supabase.from(table).select("*", { count: "exact", head: true });
    if (error) {
      console.error(`FAIL: Table '${table}' (auth-only):`, error.message || error);
      process.exit(1);
    }
    if (count !== 0 && count !== null) {
      console.error(`FAIL: Table '${table}' returned ${count} rows for anon (expected 0)`);
      process.exit(1);
    }
    console.log(`PASS: Table '${table}' protected (anon sees no rows)`);
  }

  // 3. RPC exists (will fail validation but not "function not found")
  const { error: rpcError } = await supabase.rpc("create_public_booking", {
    p_business_slug: "__smoke_test_nonexistent__",
    p_service_id: "00000000-0000-0000-0000-000000000000",
    p_staff_member_id: "00000000-0000-0000-0000-000000000000",
    p_start_at: new Date().toISOString(),
    p_client_name: "Smoke Test",
  });
  if (rpcError?.message?.includes("Could not find the function")) {
    console.error("FAIL: create_public_booking RPC not found");
    process.exit(1);
  }
  console.log("PASS: create_public_booking RPC exists");

  const { error: embedRpcError } = await supabase.rpc("get_embed_widget_context", {
    p_token: "__smoke_test_nonexistent__",
  });
  if (embedRpcError?.message?.includes("Could not find the function")) {
    console.error("FAIL: get_embed_widget_context RPC not found");
    process.exit(1);
  }
  console.log("PASS: get_embed_widget_context RPC exists");

  const { error: bookingCtxError } = await supabase.rpc("get_public_booking_context", {
    p_slug: "__smoke_test_nonexistent__",
  });
  if (bookingCtxError?.message?.includes("Could not find the function")) {
    console.error("FAIL: get_public_booking_context RPC not found");
    process.exit(1);
  }
  console.log("PASS: get_public_booking_context RPC exists");

  // Engine RPCs must be sealed off from anonymous callers entirely.
  const ENGINE_RPCS = [
    ["book_class", { p_class_session_id: "00000000-0000-0000-0000-000000000000", p_client_id: "00000000-0000-0000-0000-000000000000" }],
    ["assign_package", { p_client_id: "00000000-0000-0000-0000-000000000000", p_package_id: "00000000-0000-0000-0000-000000000000", p_amount_cents: 1, p_method: "cash" }],
    ["mark_attendance", { p_booking_id: "00000000-0000-0000-0000-000000000000", p_present: true }],
  ];
  ENGINE_RPCS.push(
    ["join_studio", { p_slug: "x", p_full_name: "x" }],
    ["get_member_schedule", { p_business_id: "00000000-0000-0000-0000-000000000000", p_from: new Date().toISOString(), p_to: new Date().toISOString() }],
    ["get_member_bookings", { p_business_id: "00000000-0000-0000-0000-000000000000" }]
  );
  for (const [fn, args] of ENGINE_RPCS) {
    const { error } = await supabase.rpc(fn, args);
    if (!error) {
      console.error(`FAIL: anon was able to call ${fn}`);
      process.exit(1);
    }
    console.log(`PASS: anon cannot call ${fn}`);
  }

  // 4. App routes (requires dev server)
  const appUrl = process.env.SMOKE_TEST_APP_URL ?? "http://localhost:3000";
  try {
    const routes = ["/", "/login", "/signup", "/join/studio-b-uat"];
    for (const route of routes) {
      const res = await fetch(`${appUrl}${route}`);
      if (!res.ok) {
        console.warn(`WARN: ${route} returned ${res.status} (is 'npm run dev' running?)`);
      } else {
        console.log(`PASS: ${route} returns ${res.status}`);
      }
    }
  } catch {
    console.warn("WARN: App not reachable at", appUrl, "— start with 'npm run dev' for full UI smoke test");
  }

  console.log("\nInfrastructure smoke test passed.");
  console.log("\nManual checklist (browser):");
  console.log("  1. /signup → create account");
  console.log("  2. /onboarding → create business");
  console.log("  3. /dashboard/services → add services");
  console.log("  4. /dashboard/staff → add staff + availability");
  console.log("  5. /dashboard/calendar → create appointment");
  console.log("  6. /book/<slug> → public booking");
  console.log("  7. /dashboard/widgets → create embed widget + copy script");
  console.log("  8. /dashboard/clients → verify client created");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
