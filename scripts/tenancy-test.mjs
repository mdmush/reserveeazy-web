#!/usr/bin/env node
/**
 * Tenancy isolation test (FSD v0.6 §1 UAT):
 * Given two studios with identical class names and member emails, when the
 * owner of studio A runs any dashboard/report query, then no row from studio B
 * is visible — and vice versa. Also asserts the anon public-booking RPC only
 * ever returns one studio's data, and that anon direct table reads are empty.
 *
 * Prerequisite: node scripts/seed-two-studios.mjs
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

const STUDIOS = [
  { slug: "studio-a-uat", email: "owner-a@cusp-uat.test" },
  { slug: "studio-b-uat", email: "owner-b@cusp-uat.test" },
];
const UAT_PASSWORD = "cusp-uat-password-1";

let failures = 0;
function check(condition, label) {
  if (condition) {
    console.log(`PASS: ${label}`);
  } else {
    console.error(`FAIL: ${label}`);
    failures++;
  }
}

function loadEnv() {
  const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  const env = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [key, ...rest] = trimmed.split("=");
    env[key] = rest.join("=");
  }
  return env;
}

async function testOwner(url, anonKey, ownStudio, otherStudio) {
  const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: ownStudio.email,
    password: UAT_PASSWORD,
  });
  if (signInError) {
    console.error(`FAIL: sign in as ${ownStudio.email}: ${signInError.message} (did you run the seed?)`);
    failures++;
    return;
  }

  const { data: businesses } = await supabase.from("businesses").select("id, slug");
  const ownIds = (businesses ?? []).map((b) => b.id);
  check(
    (businesses ?? []).length === 1 && businesses[0].slug === ownStudio.slug,
    `${ownStudio.slug}: owner sees exactly their own business`
  );
  check(
    !(businesses ?? []).some((b) => b.slug === otherStudio.slug),
    `${ownStudio.slug}: other studio's business row is invisible`
  );

  // The exact query surfaces the dashboard and reports use.
  const tables = {
    services: "id, business_id, name",
    clients: "id, business_id, email",
    appointments: "id, business_id",
    business_members: "id, business_id, email",
    business_hours: "id, business_id",
  };
  for (const [table, cols] of Object.entries(tables)) {
    const { data, error } = await supabase.from(table).select(cols);
    check(!error, `${ownStudio.slug}: ${table} query succeeds`);
    const foreign = (data ?? []).filter((r) => !ownIds.includes(r.business_id));
    check(foreign.length === 0, `${ownStudio.slug}: ${table} has zero foreign-studio rows`);
    check((data ?? []).length > 0, `${ownStudio.slug}: ${table} returns own rows`);
  }

  // Staff-child tables scope transitively; verify via join shape.
  const { data: avail } = await supabase
    .from("staff_availability")
    .select("id, business_members!inner(business_id)");
  const foreignAvail = (avail ?? []).filter(
    (r) => !ownIds.includes(r.business_members.business_id)
  );
  check(foreignAvail.length === 0, `${ownStudio.slug}: staff_availability has zero foreign rows`);

  // Reports query shape (R1/R2): identical service names + member emails must
  // still yield only the own studio's rows.
  const { data: appts } = await supabase
    .from("appointments")
    .select("business_id, business_members(display_name), clients(full_name)");
  const foreignAppts = (appts ?? []).filter((r) => !ownIds.includes(r.business_id));
  check(
    (appts ?? []).length === 3 && foreignAppts.length === 0,
    `${ownStudio.slug}: reports see exactly the 3 own appointments`
  );

  await supabase.auth.signOut();
}

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    console.error("FAIL: Missing Supabase env in .env.local");
    process.exit(1);
  }

  console.log("CUSP tenancy isolation test\n");

  const [studioA, studioB] = STUDIOS;
  await testOwner(url, anonKey, studioA, studioB);
  await testOwner(url, anonKey, studioB, studioA);

  // Anonymous surface: RPC returns exactly one studio; tables return nothing.
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  for (const [studio, other] of [
    [studioA, studioB],
    [studioB, studioA],
  ]) {
    const { data: ctx, error } = await anon.rpc("get_public_booking_context", {
      p_slug: studio.slug,
    });
    check(!error && ctx?.business?.slug === studio.slug, `anon RPC returns ${studio.slug}`);
    const staffEmails = (ctx?.staff ?? []).map((s) => s.email).filter(Boolean);
    check(staffEmails.length === 0, `anon RPC leaks no staff emails for ${studio.slug}`);
    const apptKeys = (ctx?.appointments ?? []).flatMap((a) => Object.keys(a));
    check(!apptKeys.includes("client_id"), `anon RPC leaks no client ids for ${studio.slug}`);
    const staffIds = new Set((ctx?.staff ?? []).map((s) => s.id));
    const foreignBusy = (ctx?.appointments ?? []).filter((a) => !staffIds.has(a.staff_member_id));
    check(foreignBusy.length === 0, `anon RPC busy windows belong to ${studio.slug} staff only (not ${other.slug})`);
  }

  for (const table of ["businesses", "services", "clients", "appointments", "business_members"]) {
    const { count, error } = await anon
      .from(table)
      .select("*", { count: "exact", head: true });
    check(!error && (count === 0 || count === null), `anon direct read of ${table} is empty`);
  }

  if (failures > 0) {
    console.error(`\n${failures} tenancy check(s) FAILED`);
    process.exit(1);
  }
  console.log("\nAll tenancy isolation checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
