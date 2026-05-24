"use server";

import { createClient } from "@/lib/supabase/server";
import { requireSuperuser } from "@/lib/superuser";

export async function assertAdminAccess() {
  await requireSuperuser();
}

export async function fetchAdminOverviewStats() {
  await requireSuperuser();
  const supabase = await createClient();

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [
    { count: businessCount },
    { count: userCount },
    { count: appointmentTotal },
    { count: appointmentWeek },
    { data: recentBusinesses },
    { data: recentProfiles },
  ] = await Promise.all([
    supabase.from("businesses").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("appointments").select("*", { count: "exact", head: true }),
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .gte("created_at", weekAgo.toISOString()),
    supabase
      .from("businesses")
      .select("id, name, slug, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("profiles")
      .select("id, full_name, email, created_at, is_superuser")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  return {
    businessCount: businessCount ?? 0,
    userCount: userCount ?? 0,
    appointmentTotal: appointmentTotal ?? 0,
    appointmentWeek: appointmentWeek ?? 0,
    recentBusinesses: recentBusinesses ?? [],
    recentProfiles: recentProfiles ?? [],
  };
}

export async function fetchAdminBusinesses() {
  await requireSuperuser();
  const supabase = await createClient();

  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, name, slug, business_type, timezone, created_at")
    .order("created_at", { ascending: false });

  if (!businesses?.length) return [];

  const businessIds = businesses.map((b) => b.id);

  const [{ data: members }, { data: services }, { data: appointments }] =
    await Promise.all([
      supabase.from("business_members").select("business_id").in("business_id", businessIds),
      supabase.from("services").select("business_id").in("business_id", businessIds),
      supabase.from("appointments").select("business_id").in("business_id", businessIds),
    ]);

  const countBy = (rows: { business_id: string }[] | null) => {
    const map = new Map<string, number>();
    for (const row of rows ?? []) {
      map.set(row.business_id, (map.get(row.business_id) ?? 0) + 1);
    }
    return map;
  };

  const memberCounts = countBy(members);
  const serviceCounts = countBy(services);
  const appointmentCounts = countBy(appointments);

  return businesses.map((b) => ({
    ...b,
    memberCount: memberCounts.get(b.id) ?? 0,
    serviceCount: serviceCounts.get(b.id) ?? 0,
    appointmentCount: appointmentCounts.get(b.id) ?? 0,
  }));
}

export async function fetchAdminBusinessDetail(id: string) {
  await requireSuperuser();
  const supabase = await createClient();

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!business) return null;

  const [{ data: members }, { data: services }, { data: rawAppointments }] =
    await Promise.all([
      supabase
        .from("business_members")
        .select("id, display_name, email, role, is_bookable, created_at")
        .eq("business_id", id)
        .order("created_at"),
      supabase
        .from("services")
        .select("id, name, duration_minutes, price_cents, is_active")
        .eq("business_id", id)
        .order("sort_order"),
      supabase
        .from("appointments")
        .select(
          "id, start_at, end_at, status, client_id, service_id, staff_member_id"
        )
        .eq("business_id", id)
        .order("start_at", { ascending: false })
        .limit(20),
    ]);

  const appointments = await enrichAppointments(supabase, rawAppointments ?? []);

  return {
    business,
    members: members ?? [],
    services: services ?? [],
    appointments,
  };
}

async function enrichAppointments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: {
    id: string;
    start_at: string;
    end_at: string;
    status: string;
    client_id: string;
    service_id: string;
    staff_member_id: string;
    business_id?: string;
    source?: string;
  }[]
) {
  if (!rows.length) return [];

  const clientIds = [...new Set(rows.map((r) => r.client_id))];
  const serviceIds = [...new Set(rows.map((r) => r.service_id))];
  const staffIds = [...new Set(rows.map((r) => r.staff_member_id))];
  const businessIds = [...new Set(rows.map((r) => r.business_id).filter(Boolean))] as string[];

  const [
    { data: clients },
    { data: services },
    { data: staff },
    { data: businesses },
  ] = await Promise.all([
    supabase.from("clients").select("id, full_name").in("id", clientIds),
    supabase.from("services").select("id, name").in("id", serviceIds),
    supabase.from("business_members").select("id, display_name").in("id", staffIds),
    businessIds.length
      ? supabase.from("businesses").select("id, name, slug").in("id", businessIds)
      : Promise.resolve({ data: [] }),
  ]);

  const clientMap = new Map((clients ?? []).map((c) => [c.id, c.full_name]));
  const serviceMap = new Map((services ?? []).map((s) => [s.id, s.name]));
  const staffMap = new Map((staff ?? []).map((s) => [s.id, s.display_name]));
  const businessMap = new Map((businesses ?? []).map((b) => [b.id, b]));

  return rows.map((r) => ({
    id: r.id,
    start_at: r.start_at,
    end_at: r.end_at,
    status: r.status,
    source: r.source,
    clientName: clientMap.get(r.client_id) ?? null,
    serviceName: serviceMap.get(r.service_id) ?? null,
    staffName: staffMap.get(r.staff_member_id) ?? null,
    business: r.business_id ? businessMap.get(r.business_id) ?? null : null,
  }));
}

export async function fetchAdminUsers() {
  await requireSuperuser();
  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, is_superuser, created_at")
    .order("created_at", { ascending: false });

  if (!profiles?.length) return [];

  const userIds = profiles.map((p) => p.id);
  const { data: members } = await supabase
    .from("business_members")
    .select("user_id, business_id")
    .in("user_id", userIds);

  const businessIds = [...new Set((members ?? []).map((m) => m.business_id))];
  const { data: businesses } = businessIds.length
    ? await supabase.from("businesses").select("id, name").in("id", businessIds)
    : { data: [] };

  const nameByBusinessId = new Map((businesses ?? []).map((b) => [b.id, b.name]));

  const businessesByUser = new Map<string, string[]>();
  for (const m of members ?? []) {
    if (!m.user_id) continue;
    const name = nameByBusinessId.get(m.business_id);
    if (!name) continue;
    const list = businessesByUser.get(m.user_id) ?? [];
    list.push(name);
    businessesByUser.set(m.user_id, list);
  }

  return profiles.map((p) => ({
    ...p,
    businesses: businessesByUser.get(p.id) ?? [],
  }));
}

export async function fetchAdminAppointments(page = 1, pageSize = 25) {
  await requireSuperuser();
  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data: rawRows, count } = await supabase
    .from("appointments")
    .select(
      "id, start_at, end_at, status, source, business_id, client_id, service_id, staff_member_id",
      { count: "exact" }
    )
    .order("start_at", { ascending: false })
    .range(from, to);

  const appointments = await enrichAppointments(supabase, rawRows ?? []);

  return {
    appointments,
    total: count ?? 0,
    page,
    pageSize,
  };
}
