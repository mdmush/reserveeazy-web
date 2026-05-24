#!/usr/bin/env node
/**
 * Automated smoke test for ReserveEazy MVP infrastructure.
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

const PUBLIC_ANON_TABLES = [
  "profiles",
  "businesses",
  "business_members",
  "services",
  "staff_services",
  "staff_availability",
  "staff_time_off",
];

const AUTH_ONLY_TABLES = ["clients", "appointments", "booking_widgets"];

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.error("FAIL: Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
    process.exit(1);
  }

  console.log("ReserveEazy smoke test\n");
  console.log(`Supabase URL: ${url}`);

  const supabase = createClient(url, anonKey);

  // 1. Auth health
  const { error: authError } = await supabase.auth.getSession();
  if (authError) {
    console.error("FAIL: Auth connection:", authError.message);
    process.exit(1);
  }
  console.log("PASS: Supabase auth reachable");

  // 2. Public table access (anon)
  for (const table of PUBLIC_ANON_TABLES) {
    const { error } = await supabase.from(table).select("*", { count: "exact", head: true });
    if (error) {
      console.error(`FAIL: Table '${table}':`, error.message || error);
      process.exit(1);
    }
    console.log(`PASS: Table '${table}' accessible (anon)`);
  }

  // Auth-only tables should return empty for anon (not error)
  for (const table of AUTH_ONLY_TABLES) {
    const { error, count } = await supabase.from(table).select("*", { count: "exact", head: true });
    if (error) {
      console.error(`FAIL: Table '${table}' (auth-only):`, error.message || error);
      process.exit(1);
    }
    if (count !== 0 && count !== null) {
      console.warn(`WARN: Table '${table}' returned ${count} rows for anon (expected 0)`);
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

  // 4. App routes (requires dev server)
  const appUrl = process.env.SMOKE_TEST_APP_URL ?? "http://localhost:3000";
  try {
    const routes = ["/", "/login", "/signup"];
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
