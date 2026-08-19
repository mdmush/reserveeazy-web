"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/app-url";
import { requireMemberClient, getActingClients } from "@/lib/member";
import {
  magicLinkSchema,
  joinRequestSchema,
  completeProfileSchema,
  type MagicLinkInput,
  type JoinRequestInput,
  type CompleteProfileInput,
} from "@/lib/validations";

/**
 * Sign-in link for existing accounts. Always reports success so the form
 * cannot be used to probe which emails have accounts.
 */
export async function sendMagicLinkAction(data: MagicLinkInput) {
  const parsed = magicLinkSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${getAppUrl()}/portal`,
    },
  });

  return { success: true };
}

/** Join link for a studio: creates the auth user if needed. */
export async function sendJoinLinkAction(slug: string, data: JoinRequestInput) {
  const parsed = joinRequestSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${getAppUrl()}/join/${encodeURIComponent(slug)}/complete`,
      data: { full_name: parsed.data.fullName },
    },
  });

  if (error) return { error: error.message };
  return { success: true };
}

async function requireActingClient(slug: string, clientId: string) {
  const context = await requireMemberClient(slug);
  const acting = getActingClients(context);
  if (!acting.some((c) => c.id === clientId)) {
    throw new Error("Not allowed to act for this member");
  }
  return context;
}

function revalidatePortal(slug: string) {
  revalidatePath(`/portal/${slug}`);
  revalidatePath(`/portal/${slug}/schedule`);
  revalidatePath(`/portal/${slug}/bookings`);
}

export async function memberBookAction(input: {
  slug: string;
  sessionId: string;
  clientId: string;
}) {
  const context = await requireActingClient(input.slug, input.clientId);
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("book_class", {
    p_class_session_id: input.sessionId,
    p_client_id: input.clientId,
  });

  if (error) return { error: friendlyMemberError(error.message, context) };
  revalidatePortal(input.slug);
  return { success: true, result: data as Record<string, unknown> };
}

export async function memberCancelAction(input: {
  slug: string;
  bookingId: string;
  clientId: string;
}) {
  await requireActingClient(input.slug, input.clientId);
  const supabase = await createClient();

  // Members never pass the force-refund override.
  const { data, error } = await supabase.rpc("cancel_booking", {
    p_booking_id: input.bookingId,
  });

  if (error) return { error: error.message };
  revalidatePortal(input.slug);
  return { success: true, result: data as Record<string, unknown> };
}

export async function memberClaimOfferAction(input: {
  slug: string;
  bookingId: string;
  clientId: string;
}) {
  const context = await requireActingClient(input.slug, input.clientId);
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("claim_waitlist_offer", {
    p_booking_id: input.bookingId,
  });

  if (error) return { error: friendlyMemberError(error.message, context) };
  revalidatePortal(input.slug);
  return { success: true, result: data as Record<string, unknown> };
}

export async function memberAcceptWaiverAction(input: {
  slug: string;
  clientId: string;
  signatureName: string;
}) {
  const context = await requireActingClient(input.slug, input.clientId);
  if (!input.signatureName.trim()) {
    return { error: "Type your name to sign" };
  }
  const supabase = await createClient();

  const { error } = await supabase.rpc("record_waiver_acceptance", {
    p_client_id: input.clientId,
    p_signature_name: input.signatureName,
    // Guardians sign for dependents; self-signing sends null.
    p_accepted_by_client_id:
      input.clientId === context.client.id ? null : context.client.id,
  });

  if (error) return { error: error.message };
  revalidatePortal(input.slug);
  return { success: true };
}

function friendlyMemberError(
  message: string,
  context: Awaited<ReturnType<typeof requireMemberClient>>
) {
  if (message.includes("No eligible package")) {
    return `No credits left for this class — top up your package at ${context.business.name}'s front desk.`;
  }
  if (message.includes("not accepted the current waiver")) {
    return "Please sign the studio waiver first (see the banner on your home page).";
  }
  return message;
}

export async function joinStudioAction(slug: string, data: CompleteProfileInput) {
  const parsed = completeProfileSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { data: clientId, error } = await supabase.rpc("join_studio", {
    p_slug: slug,
    p_full_name: parsed.data.fullName,
    p_phone: parsed.data.phone || null,
  });

  if (error) return { error: error.message };
  revalidatePath("/portal");
  return { success: true, clientId: clientId as string };
}
