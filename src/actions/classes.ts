"use server";

import { revalidatePath } from "next/cache";
import { addDays, addMinutes, parseISO } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { createClient } from "@/lib/supabase/server";
import { requireAdminMembership } from "@/lib/business";
import {
  classTypeSchema,
  classSessionSchema,
  type ClassTypeInput,
  type ClassSessionInput,
} from "@/lib/validations";

// Safety cap on weekly-recurrence generation (~1 year of sessions).
const MAX_RECURRENCE_OCCURRENCES = 53;

export async function createClassTypeAction(data: ClassTypeInput) {
  const parsed = classTypeSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const membership = await requireAdminMembership();
  const supabase = await createClient();

  const { data: maxOrder } = await supabase
    .from("class_types")
    .select("sort_order")
    .eq("business_id", membership.business_id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("class_types").insert({
    business_id: membership.business_id,
    name: parsed.data.name,
    description: parsed.data.description || null,
    color: parsed.data.color || null,
    default_duration_minutes: parsed.data.defaultDurationMinutes,
    default_capacity: parsed.data.defaultCapacity,
    credit_cost: parsed.data.creditCost,
    drop_in_price_cents: parsed.data.dropInPriceCents,
    is_active: parsed.data.isActive,
    sort_order: (maxOrder?.sort_order ?? 0) + 1,
  });

  if (error) return { error: friendlyClassTypeError(error.message) };
  revalidatePath("/dashboard/classes");
  return { success: true };
}

export async function updateClassTypeAction(id: string, data: ClassTypeInput) {
  const parsed = classTypeSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const membership = await requireAdminMembership();
  const supabase = await createClient();

  const { error } = await supabase
    .from("class_types")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      color: parsed.data.color || null,
      default_duration_minutes: parsed.data.defaultDurationMinutes,
      default_capacity: parsed.data.defaultCapacity,
      credit_cost: parsed.data.creditCost,
      drop_in_price_cents: parsed.data.dropInPriceCents,
      is_active: parsed.data.isActive,
    })
    .eq("id", id)
    .eq("business_id", membership.business_id);

  if (error) return { error: friendlyClassTypeError(error.message) };
  revalidatePath("/dashboard/classes");
  return { success: true };
}

export async function deleteClassTypeAction(id: string) {
  const membership = await requireAdminMembership();
  const supabase = await createClient();

  const { error } = await supabase
    .from("class_types")
    .delete()
    .eq("id", id)
    .eq("business_id", membership.business_id);

  if (error) {
    if (error.message.includes("violates foreign key")) {
      return {
        error:
          "This class type has scheduled sessions or packages. Deactivate it instead.",
      };
    }
    return { error: error.message };
  }
  revalidatePath("/dashboard/classes");
  return { success: true };
}

function friendlyClassTypeError(message: string) {
  if (message.includes("class_types_business_name_key")) {
    return "A class type with this name already exists";
  }
  return message;
}

function friendlySessionError(message: string) {
  if (message.includes("class_sessions_teacher_no_overlap")) {
    return "The teacher already has a session in this time range — nothing was scheduled";
  }
  return message;
}

export async function createClassSessionsAction(data: ClassSessionInput) {
  const parsed = classSessionSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const membership = await requireAdminMembership();
  const supabase = await createClient();
  const timezone = membership.businesses.timezone;
  const input = parsed.data;

  // Verify the class type and teacher belong to this business.
  const [{ data: classType }, { data: teacher }] = await Promise.all([
    supabase
      .from("class_types")
      .select("id")
      .eq("id", input.classTypeId)
      .eq("business_id", membership.business_id)
      .maybeSingle(),
    supabase
      .from("business_members")
      .select("id")
      .eq("id", input.teacherId)
      .eq("business_id", membership.business_id)
      .maybeSingle(),
  ]);
  if (!classType) return { error: "Class type not found" };
  if (!teacher) return { error: "Teacher not found" };

  // Sessions are stored as UTC instants; the form's date/time are studio-local.
  const dates: string[] = [input.date];
  if (input.repeatWeekly && input.repeatUntil) {
    let next = addDays(parseISO(input.date), 7);
    const until = parseISO(input.repeatUntil);
    while (next <= until && dates.length < MAX_RECURRENCE_OCCURRENCES) {
      dates.push(next.toISOString().slice(0, 10));
      next = addDays(next, 7);
    }
  }

  const recurrenceGroupId =
    dates.length > 1 ? crypto.randomUUID() : null;

  const rows = dates.map((date) => {
    const startAt = fromZonedTime(`${date}T${input.startTime}:00`, timezone);
    return {
      business_id: membership.business_id,
      class_type_id: input.classTypeId,
      teacher_id: input.teacherId,
      start_at: startAt.toISOString(),
      end_at: addMinutes(startAt, input.durationMinutes).toISOString(),
      capacity: input.capacity,
      room: input.room || null,
      notes: input.notes || null,
      recurrence_group_id: recurrenceGroupId,
    };
  });

  // One statement = atomic: any teacher clash rejects the whole batch.
  const { error } = await supabase.from("class_sessions").insert(rows);
  if (error) return { error: friendlySessionError(error.message) };

  revalidatePath("/dashboard/schedule");
  return { success: true, count: rows.length };
}

export async function updateClassSessionAction(
  id: string,
  data: ClassSessionInput
) {
  const parsed = classSessionSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const membership = await requireAdminMembership();
  const supabase = await createClient();
  const timezone = membership.businesses.timezone;
  const input = parsed.data;

  const startAt = fromZonedTime(`${input.date}T${input.startTime}:00`, timezone);
  const { error } = await supabase
    .from("class_sessions")
    .update({
      class_type_id: input.classTypeId,
      teacher_id: input.teacherId,
      start_at: startAt.toISOString(),
      end_at: addMinutes(startAt, input.durationMinutes).toISOString(),
      capacity: input.capacity,
      room: input.room || null,
      notes: input.notes || null,
    })
    .eq("id", id)
    .eq("business_id", membership.business_id);

  if (error) return { error: friendlySessionError(error.message) };
  revalidatePath("/dashboard/schedule");
  revalidatePath(`/dashboard/schedule/${id}`);
  return { success: true };
}

export async function cancelClassSessionAction(
  id: string,
  scope: "single" | "future" = "single"
) {
  const membership = await requireAdminMembership();
  const supabase = await createClient();

  const { data: session } = await supabase
    .from("class_sessions")
    .select("id, start_at, recurrence_group_id")
    .eq("id", id)
    .eq("business_id", membership.business_id)
    .maybeSingle();
  if (!session) return { error: "Session not found" };

  let query = supabase
    .from("class_sessions")
    .update({ status: "cancelled" })
    .eq("business_id", membership.business_id);

  if (scope === "future" && session.recurrence_group_id) {
    query = query
      .eq("recurrence_group_id", session.recurrence_group_id)
      .gte("start_at", session.start_at);
  } else {
    query = query.eq("id", id);
  }

  const { error } = await query;
  if (error) return { error: error.message };
  revalidatePath("/dashboard/schedule");
  return { success: true };
}
