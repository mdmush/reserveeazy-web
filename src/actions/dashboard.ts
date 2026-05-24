"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMembership } from "@/lib/business";
import {
  serviceSchema,
  staffSchema,
  clientSchema,
  appointmentSchema,
  settingsSchema,
  availabilitySchema,
  type ServiceInput,
  type StaffInput,
  type ClientInput,
  type AppointmentInput,
  type SettingsInput,
} from "@/lib/validations";
import { addMinutes, parseISO } from "date-fns";

export async function createServiceAction(data: ServiceInput) {
  const parsed = serviceSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const membership = await requireMembership();
  const supabase = await createClient();

  const { data: maxOrder } = await supabase
    .from("services")
    .select("sort_order")
    .eq("business_id", membership.business_id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("services").insert({
    business_id: membership.business_id,
    name: parsed.data.name,
    description: parsed.data.description || null,
    duration_minutes: parsed.data.durationMinutes,
    price_cents: parsed.data.priceCents,
    is_active: parsed.data.isActive,
    sort_order: (maxOrder?.sort_order ?? -1) + 1,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/services");
  return { success: true };
}

export async function updateServiceAction(id: string, data: ServiceInput) {
  const parsed = serviceSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const membership = await requireMembership();
  const supabase = await createClient();

  const { error } = await supabase
    .from("services")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      duration_minutes: parsed.data.durationMinutes,
      price_cents: parsed.data.priceCents,
      is_active: parsed.data.isActive,
    })
    .eq("id", id)
    .eq("business_id", membership.business_id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/services");
  return { success: true };
}

export async function deleteServiceAction(id: string) {
  const membership = await requireMembership();
  const supabase = await createClient();

  const { error } = await supabase
    .from("services")
    .delete()
    .eq("id", id)
    .eq("business_id", membership.business_id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/services");
  return { success: true };
}

export async function createStaffAction(data: StaffInput) {
  const parsed = staffSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const membership = await requireMembership();
  const supabase = await createClient();

  const { data: staff, error } = await supabase
    .from("business_members")
    .insert({
      business_id: membership.business_id,
      display_name: parsed.data.displayName,
      email: parsed.data.email || null,
      role: parsed.data.role,
      is_bookable: parsed.data.isBookable,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  if (parsed.data.serviceIds.length > 0) {
    await supabase.from("staff_services").insert(
      parsed.data.serviceIds.map((serviceId) => ({
        staff_member_id: staff.id,
        service_id: serviceId,
      }))
    );
  }

  revalidatePath("/dashboard/staff");
  return { success: true };
}

export async function updateStaffAction(id: string, data: StaffInput) {
  const parsed = staffSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const membership = await requireMembership();
  const supabase = await createClient();

  const { error } = await supabase
    .from("business_members")
    .update({
      display_name: parsed.data.displayName,
      email: parsed.data.email || null,
      role: parsed.data.role,
      is_bookable: parsed.data.isBookable,
    })
    .eq("id", id)
    .eq("business_id", membership.business_id);

  if (error) return { error: error.message };

  await supabase.from("staff_services").delete().eq("staff_member_id", id);
  if (parsed.data.serviceIds.length > 0) {
    await supabase.from("staff_services").insert(
      parsed.data.serviceIds.map((serviceId) => ({
        staff_member_id: id,
        service_id: serviceId,
      }))
    );
  }

  revalidatePath("/dashboard/staff");
  return { success: true };
}

export async function deleteStaffAction(id: string) {
  const membership = await requireMembership();
  const supabase = await createClient();

  const { error } = await supabase
    .from("business_members")
    .delete()
    .eq("id", id)
    .eq("business_id", membership.business_id)
    .neq("role", "owner");

  if (error) return { error: error.message };
  revalidatePath("/dashboard/staff");
  return { success: true };
}

export async function addAvailabilityAction(
  staffMemberId: string,
  data: { dayOfWeek: number; startTime: string; endTime: string }
) {
  const parsed = availabilitySchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const membership = await requireMembership();
  const supabase = await createClient();

  const { data: staff } = await supabase
    .from("business_members")
    .select("id")
    .eq("id", staffMemberId)
    .eq("business_id", membership.business_id)
    .single();

  if (!staff) return { error: "Staff not found" };

  const { error } = await supabase.from("staff_availability").insert({
    staff_member_id: staffMemberId,
    day_of_week: parsed.data.dayOfWeek,
    start_time: parsed.data.startTime,
    end_time: parsed.data.endTime,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/staff");
  return { success: true };
}

export async function deleteAvailabilityAction(id: string) {
  const supabase = await createClient();
  await requireMembership();

  const { error } = await supabase
    .from("staff_availability")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/staff");
  return { success: true };
}

export async function createClientAction(data: ClientInput) {
  const parsed = clientSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const membership = await requireMembership();
  const supabase = await createClient();

  const { data: client, error } = await supabase
    .from("clients")
    .insert({
      business_id: membership.business_id,
      full_name: parsed.data.fullName,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      notes: parsed.data.notes || null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/dashboard/clients");
  return { success: true, clientId: client.id };
}

export async function updateClientAction(id: string, data: ClientInput) {
  const parsed = clientSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const membership = await requireMembership();
  const supabase = await createClient();

  const { error } = await supabase
    .from("clients")
    .update({
      full_name: parsed.data.fullName,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      notes: parsed.data.notes || null,
    })
    .eq("id", id)
    .eq("business_id", membership.business_id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/clients");
  revalidatePath(`/dashboard/clients/${id}`);
  return { success: true };
}

export async function createAppointmentAction(data: AppointmentInput) {
  const parsed = appointmentSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const membership = await requireMembership();
  const supabase = await createClient();

  const { data: service } = await supabase
    .from("services")
    .select("duration_minutes")
    .eq("id", parsed.data.serviceId)
    .single();

  if (!service) return { error: "Service not found" };

  const startAt = parseISO(parsed.data.startAt);
  const endAt = addMinutes(startAt, service.duration_minutes);

  const { error } = await supabase.from("appointments").insert({
    business_id: membership.business_id,
    client_id: parsed.data.clientId,
    staff_member_id: parsed.data.staffMemberId,
    service_id: parsed.data.serviceId,
    start_at: startAt.toISOString(),
    end_at: endAt.toISOString(),
    notes: parsed.data.notes || null,
    status: "confirmed",
    source: "dashboard",
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/calendar");
  return { success: true };
}

export async function updateAppointmentStatusAction(
  id: string,
  status: "pending" | "confirmed" | "cancelled" | "completed" | "no_show"
) {
  const membership = await requireMembership();
  const supabase = await createClient();

  const { error } = await supabase
    .from("appointments")
    .update({ status })
    .eq("id", id)
    .eq("business_id", membership.business_id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/calendar");
  return { success: true };
}

export async function updateSettingsAction(data: SettingsInput) {
  const parsed = settingsSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const membership = await requireMembership();
  const supabase = await createClient();

  const { error } = await supabase
    .from("businesses")
    .update({
      name: parsed.data.name,
      slug: parsed.data.slug,
      business_type: parsed.data.businessType,
      timezone: parsed.data.timezone,
      settings: {
        slot_interval_minutes: parsed.data.slotIntervalMinutes,
        min_notice_hours: parsed.data.minNoticeHours,
        max_advance_days: parsed.data.maxAdvanceDays,
        auto_confirm: parsed.data.autoConfirm,
      },
    })
    .eq("id", membership.business_id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/settings");
  return { success: true };
}

export async function createPublicBookingAction(input: {
  businessSlug: string;
  serviceId: string;
  staffMemberId: string;
  startAt: string;
  fullName: string;
  email?: string;
  phone?: string;
}) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("create_public_booking", {
    p_business_slug: input.businessSlug,
    p_service_id: input.serviceId,
    p_staff_member_id: input.staffMemberId,
    p_start_at: input.startAt,
    p_client_name: input.fullName,
    p_client_email: input.email || null,
    p_client_phone: input.phone || null,
  });

  if (error) return { error: error.message };
  return { success: true, appointmentId: data as string };
}
