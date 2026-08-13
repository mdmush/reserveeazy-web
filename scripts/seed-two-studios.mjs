#!/usr/bin/env node
/**
 * UAT seed (FSD v0.6 §1): two studios with IDENTICAL service names and
 * IDENTICAL client emails, so the tenancy test can prove no report or query
 * leaks rows across studios.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (never commit it).
 *
 * Run:      node scripts/seed-two-studios.mjs
 * Cleanup:  node scripts/seed-two-studios.mjs --cleanup
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

const STUDIOS = [
  { slug: "studio-a-uat", name: "UAT Studio A", email: "owner-a@cusp-uat.test" },
  { slug: "studio-b-uat", name: "UAT Studio B", email: "owner-b@cusp-uat.test" },
];
const UAT_PASSWORD = "cusp-uat-password-1";
const SHARED_CLIENT_EMAIL = "member@cusp-uat.test";
const SERVICE_NAMES = ["Ballet Beginner", "Yoga Flow"];

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

async function findUserByEmail(admin, email) {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  return data.users.find((u) => u.email === email) ?? null;
}

async function cleanup(admin) {
  for (const studio of STUDIOS) {
    const { data: biz } = await admin
      .from("businesses")
      .select("id")
      .eq("slug", studio.slug)
      .maybeSingle();
    if (biz) {
      // Child rows first; staff join tables cascade from business_members.
      await admin.from("appointments").delete().eq("business_id", biz.id);
      await admin.from("clients").delete().eq("business_id", biz.id);
      await admin.from("booking_widgets").delete().eq("business_id", biz.id);
      await admin.from("business_hours").delete().eq("business_id", biz.id);
      const { data: members } = await admin
        .from("business_members")
        .select("id")
        .eq("business_id", biz.id);
      const memberIds = (members ?? []).map((m) => m.id);
      if (memberIds.length) {
        await admin.from("staff_availability").delete().in("staff_member_id", memberIds);
        await admin.from("staff_services").delete().in("staff_member_id", memberIds);
        await admin.from("staff_time_off").delete().in("staff_member_id", memberIds);
      }
      await admin.from("services").delete().eq("business_id", biz.id);
      await admin.from("business_members").delete().eq("business_id", biz.id);
      await admin.from("businesses").delete().eq("id", biz.id);
      console.log(`Cleaned up ${studio.slug}`);
    }
    const user = await findUserByEmail(admin, studio.email);
    if (user) {
      await admin.auth.admin.deleteUser(user.id);
      console.log(`Deleted user ${studio.email}`);
    }
  }
}

async function seedStudio(admin, studio) {
  const { data: created, error: userError } = await admin.auth.admin.createUser({
    email: studio.email,
    password: UAT_PASSWORD,
    email_confirm: true,
  });
  if (userError) throw new Error(`createUser ${studio.email}: ${userError.message}`);
  const userId = created.user.id;

  const { data: biz, error: bizError } = await admin
    .from("businesses")
    .insert({ name: studio.name, slug: studio.slug, business_type: "other", timezone: "Asia/Kuala_Lumpur" })
    .select("id")
    .single();
  if (bizError) throw new Error(`business ${studio.slug}: ${bizError.message}`);

  const { data: owner, error: memberError } = await admin
    .from("business_members")
    .insert({
      business_id: biz.id,
      user_id: userId,
      display_name: `${studio.name} Owner`,
      email: studio.email,
      role: "owner",
      is_bookable: true,
    })
    .select("id")
    .single();
  if (memberError) throw new Error(`member: ${memberError.message}`);

  await admin.from("business_hours").insert(
    [1, 2, 3, 4, 5].map((d) => ({
      business_id: biz.id,
      day_of_week: d,
      start_time: "09:00",
      end_time: "18:00",
    }))
  );
  await admin.from("staff_availability").insert(
    [1, 2, 3, 4, 5].map((d) => ({
      staff_member_id: owner.id,
      day_of_week: d,
      start_time: "09:00",
      end_time: "18:00",
    }))
  );

  const { data: services, error: svcError } = await admin
    .from("services")
    .insert(
      SERVICE_NAMES.map((name, i) => ({
        business_id: biz.id,
        name,
        duration_minutes: 60,
        price_cents: 4500,
        is_active: true,
        sort_order: i,
      }))
    )
    .select("id");
  if (svcError) throw new Error(`services: ${svcError.message}`);

  await admin.from("staff_services").insert(
    services.map((s) => ({ staff_member_id: owner.id, service_id: s.id }))
  );

  // Same client email in both studios — the isolation test hinges on this.
  const { data: client, error: clientError } = await admin
    .from("clients")
    .insert({
      business_id: biz.id,
      full_name: `Member of ${studio.name}`,
      email: SHARED_CLIENT_EMAIL,
    })
    .select("id")
    .single();
  if (clientError) throw new Error(`client: ${clientError.message}`);

  // Three sessions this month at staggered past/future times.
  const now = new Date();
  const mk = (dayOffset, hour, status) => {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + dayOffset, hour, 0, 0));
    const end = new Date(start.getTime() + 60 * 60_000);
    return {
      business_id: biz.id,
      client_id: client.id,
      staff_member_id: owner.id,
      service_id: services[0].id,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      status,
      source: "dashboard",
    };
  };
  const { error: apptError } = await admin
    .from("appointments")
    .insert([mk(-2, 2, "completed"), mk(-1, 4, "completed"), mk(1, 6, "confirmed")]);
  if (apptError) throw new Error(`appointments: ${apptError.message}`);

  console.log(`Seeded ${studio.slug} (business ${biz.id})`);
  return biz.id;
}

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("FAIL: Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  await cleanup(admin);
  if (process.argv.includes("--cleanup")) {
    console.log("Cleanup complete.");
    return;
  }
  for (const studio of STUDIOS) {
    await seedStudio(admin, studio);
  }
  console.log("\nSeed complete. Run: npm run tenancy-test");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
