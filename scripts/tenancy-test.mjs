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

  // Membership-build tables: zero foreign rows (own rows optional — studio A
  // runs simple mode and has no class/credit data by design).
  const engineTables = [
    "class_types",
    "class_sessions",
    "packages",
    "package_instances",
    "credit_transactions",
    "payments",
    "bookings",
    "grace_passes",
    "commission_events",
    "payment_dues",
    "waiver_versions",
    "waiver_acceptances",
  ];
  for (const table of engineTables) {
    const { data, error } = await supabase.from(table).select("business_id");
    check(!error, `${ownStudio.slug}: ${table} query succeeds`);
    const foreign = (data ?? []).filter((r) => !ownIds.includes(r.business_id));
    check(
      foreign.length === 0,
      `${ownStudio.slug}: ${table} has zero foreign-studio rows`
    );
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

  // ---- member (portal) isolation ----------------------------------------
  const member = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: memberSignIn } = await member.auth.signInWithPassword({
    email: "portal-member@cusp-uat.test",
    password: UAT_PASSWORD,
  });
  if (memberSignIn) {
    console.error(`FAIL: portal member sign-in: ${memberSignIn.message}`);
    failures++;
  } else {
    const { data: memberBiz } = await member.from("businesses").select("id, slug");
    check(
      (memberBiz ?? []).length === 1 && memberBiz[0].slug === "studio-b-uat",
      "portal member sees only their own studio"
    );
    const bizBId = memberBiz?.[0]?.id;

    const { data: memberClients } = await member.from("clients").select("id, email");
    check(
      (memberClients ?? []).length === 1 &&
        memberClients[0].email === "portal-member@cusp-uat.test",
      "portal member sees only their own client record (no other members)"
    );

    for (const table of ["class_sessions", "business_members"]) {
      const { data } = await member.from(table).select("*");
      check(
        (data ?? []).length === 0,
        `portal member has no direct read on ${table}`
      );
    }

    const { data: foreignSched, error: foreignSchedErr } = await member.rpc(
      "get_member_schedule",
      {
        p_business_id: "00000000-0000-0000-0000-000000000000",
        p_from: new Date().toISOString(),
        p_to: new Date(Date.now() + 86400000).toISOString(),
      }
    );
    check(
      !!foreignSchedErr && !foreignSched,
      "get_member_schedule rejects studios the member doesn't belong to"
    );

    const { data: ownSched, error: ownSchedErr } = await member.rpc(
      "get_member_schedule",
      {
        p_business_id: bizBId,
        p_from: new Date().toISOString(),
        p_to: new Date(Date.now() + 7 * 86400000).toISOString(),
      }
    );
    check(
      !ownSchedErr && Array.isArray(ownSched),
      "portal member reads their studio's schedule via the RPC",
      ownSchedErr?.message
    );
    const leakyKeys = (ownSched ?? []).flatMap((s) =>
      Object.keys(s).filter((k) => k === "teacher_email" || k === "user_id")
    );
    check(leakyKeys.length === 0, "schedule RPC exposes no emails or user ids");

    await member.auth.signOut();
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
