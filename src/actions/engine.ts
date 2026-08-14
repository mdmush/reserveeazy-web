"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdminMembership, requireMembership } from "@/lib/business";
import {
  packageSchema,
  assignPackageSchema,
  adjustCreditsSchema,
  type PackageInput,
  type AssignPackageInput,
  type AdjustCreditsInput,
} from "@/lib/validations";

export async function createPackageAction(data: PackageInput) {
  const parsed = packageSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const membership = await requireAdminMembership();
  const supabase = await createClient();

  const { data: maxOrder } = await supabase
    .from("packages")
    .select("sort_order")
    .eq("business_id", membership.business_id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("packages").insert({
    business_id: membership.business_id,
    name: parsed.data.name,
    scope: parsed.data.scope,
    class_type_id:
      parsed.data.scope === "locked" ? parsed.data.classTypeId || null : null,
    credit_count: parsed.data.creditCount,
    validity_days: parsed.data.validityDays,
    expiry_trigger: parsed.data.expiryTrigger,
    price_cents: parsed.data.priceCents,
    is_active: parsed.data.isActive,
    sort_order: (maxOrder?.sort_order ?? 0) + 1,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/packages");
  return { success: true };
}

export async function updatePackageAction(id: string, data: PackageInput) {
  const parsed = packageSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const membership = await requireAdminMembership();
  const supabase = await createClient();

  const { error } = await supabase
    .from("packages")
    .update({
      name: parsed.data.name,
      scope: parsed.data.scope,
      class_type_id:
        parsed.data.scope === "locked" ? parsed.data.classTypeId || null : null,
      credit_count: parsed.data.creditCount,
      validity_days: parsed.data.validityDays,
      expiry_trigger: parsed.data.expiryTrigger,
      price_cents: parsed.data.priceCents,
      is_active: parsed.data.isActive,
    })
    .eq("id", id)
    .eq("business_id", membership.business_id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/packages");
  return { success: true };
}

export async function deletePackageAction(id: string) {
  const membership = await requireAdminMembership();
  const supabase = await createClient();

  const { error } = await supabase
    .from("packages")
    .delete()
    .eq("id", id)
    .eq("business_id", membership.business_id);

  if (error) {
    if (error.message.includes("violates foreign key")) {
      return {
        error: "This package has been sold to members. Deactivate it instead.",
      };
    }
    return { error: error.message };
  }
  revalidatePath("/dashboard/packages");
  return { success: true };
}

export async function assignPackageAction(data: AssignPackageInput) {
  const parsed = assignPackageSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  await requireAdminMembership();
  const supabase = await createClient();

  const { data: result, error } = await supabase.rpc("assign_package", {
    p_client_id: parsed.data.clientId,
    p_package_id: parsed.data.packageId,
    p_amount_cents: parsed.data.amountCents,
    p_method: parsed.data.method,
    p_notes: parsed.data.notes || null,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/packages");
  revalidatePath(`/dashboard/clients/${parsed.data.clientId}`);
  revalidatePath("/dashboard/receipts");
  return {
    success: true,
    receiptNumber: (result as { receipt_number?: string } | null)
      ?.receipt_number,
    paymentId: (result as { payment_id?: string } | null)?.payment_id,
  };
}

export async function bookClassAction(input: {
  classSessionId: string;
  clientId: string;
  packageInstanceId?: string;
  gracePassId?: string;
  joinWaitlist?: boolean;
}) {
  await requireAdminMembership();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("book_class", {
    p_class_session_id: input.classSessionId,
    p_client_id: input.clientId,
    p_package_instance_id: input.packageInstanceId ?? null,
    p_grace_pass_id: input.gracePassId ?? null,
    p_join_waitlist: input.joinWaitlist ?? true,
  });

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/schedule/${input.classSessionId}`);
  return { success: true, result: data as Record<string, unknown> };
}

export async function cancelBookingAction(input: {
  bookingId: string;
  classSessionId: string;
  forceRefund?: boolean;
}) {
  await requireAdminMembership();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("cancel_booking", {
    p_booking_id: input.bookingId,
    p_force_refund: input.forceRefund ?? false,
  });

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/schedule/${input.classSessionId}`);
  return { success: true, result: data as Record<string, unknown> };
}

// Teachers may mark attendance for their own sessions, so this only requires
// membership — the RPC enforces admin-or-own-teacher.
export async function markAttendanceAction(input: {
  bookingId: string;
  classSessionId: string;
  present: boolean;
}) {
  await requireMembership();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("mark_attendance", {
    p_booking_id: input.bookingId,
    p_present: input.present,
  });

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/schedule/${input.classSessionId}`);
  revalidatePath(`/dashboard/teach/${input.classSessionId}`);
  return { success: true, result: data as Record<string, unknown> };
}

export async function revertAttendanceAction(input: {
  bookingId: string;
  classSessionId: string;
  reason: string;
}) {
  await requireAdminMembership();
  if (!input.reason.trim()) return { error: "A reason is required" };
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("revert_attendance", {
    p_booking_id: input.bookingId,
    p_reason: input.reason,
  });

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/schedule/${input.classSessionId}`);
  return { success: true, result: data as Record<string, unknown> };
}

export async function setCommissionRateAction(input: {
  teacherId: string;
  classTypeId: string | null;
  ratePerHeadCents: number;
}) {
  const membership = await requireAdminMembership();
  if (input.ratePerHeadCents < 0) return { error: "Rate cannot be negative" };
  const supabase = await createClient();

  let existingQuery = supabase
    .from("commission_rates")
    .select("id")
    .eq("business_id", membership.business_id)
    .eq("teacher_id", input.teacherId);
  existingQuery =
    input.classTypeId === null
      ? existingQuery.is("class_type_id", null)
      : existingQuery.eq("class_type_id", input.classTypeId);
  const { data: existing } = await existingQuery.maybeSingle();

  const { error } = existing
    ? await supabase
        .from("commission_rates")
        .update({ rate_per_head_cents: input.ratePerHeadCents })
        .eq("id", existing.id)
    : await supabase.from("commission_rates").insert({
        business_id: membership.business_id,
        teacher_id: input.teacherId,
        class_type_id: input.classTypeId,
        rate_per_head_cents: input.ratePerHeadCents,
      });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/staff");
  return { success: true };
}

export async function offerWaitlistSpotAction(input: {
  bookingId: string;
  classSessionId: string;
}) {
  await requireAdminMembership();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("offer_waitlist_spot", {
    p_booking_id: input.bookingId,
  });
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/schedule/${input.classSessionId}`);
  return { success: true, result: data as Record<string, unknown> };
}

export async function claimWaitlistOfferAction(input: {
  bookingId: string;
  classSessionId: string;
}) {
  await requireAdminMembership();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_waitlist_offer", {
    p_booking_id: input.bookingId,
  });
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/schedule/${input.classSessionId}`);
  return { success: true, result: data as Record<string, unknown> };
}

export async function releaseWaitlistOfferAction(input: {
  bookingId: string;
  classSessionId: string;
}) {
  await requireAdminMembership();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("release_waitlist_offer", {
    p_booking_id: input.bookingId,
  });
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/schedule/${input.classSessionId}`);
  return { success: true, result: data as Record<string, unknown> };
}

export async function grantGracePassAction(input: {
  clientId: string;
  reason: string;
  sourceBookingId?: string;
}) {
  await requireAdminMembership();
  if (!input.reason.trim()) return { error: "A reason is required" };
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("grant_grace_pass", {
    p_client_id: input.clientId,
    p_reason: input.reason,
    p_source_booking_id: input.sourceBookingId ?? null,
  });

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/clients/${input.clientId}`);
  return { success: true, passId: data as string };
}

export async function revokeGracePassAction(input: {
  passId: string;
  clientId: string;
  reason: string;
}) {
  await requireAdminMembership();
  if (!input.reason.trim()) return { error: "A reason is required" };
  const supabase = await createClient();

  const { error } = await supabase.rpc("revoke_grace_pass", {
    p_pass_id: input.passId,
    p_reason: input.reason,
  });

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/clients/${input.clientId}`);
  return { success: true };
}

export async function adjustCreditsAction(data: AdjustCreditsInput) {
  const parsed = adjustCreditsSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  await requireAdminMembership();
  const supabase = await createClient();

  const { error } = await supabase.rpc("adjust_credits", {
    p_package_instance_id: parsed.data.packageInstanceId,
    p_amount: parsed.data.amount,
    p_reason: parsed.data.reason,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/clients");
  return { success: true };
}
