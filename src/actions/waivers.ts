"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdminMembership } from "@/lib/business";

export async function createWaiverVersionAction(input: {
  title: string;
  body: string;
}) {
  if (!input.title.trim() || !input.body.trim()) {
    return { error: "Title and body are required" };
  }
  const membership = await requireAdminMembership();
  const supabase = await createClient();

  const { data: latest } = await supabase
    .from("waiver_versions")
    .select("version")
    .eq("business_id", membership.business_id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("waiver_versions").insert({
    business_id: membership.business_id,
    version: (latest?.version ?? 0) + 1,
    title: input.title,
    body: input.body,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/waivers");
  return { success: true };
}

export async function updateWaiverDraftAction(input: {
  id: string;
  title: string;
  body: string;
}) {
  const membership = await requireAdminMembership();
  const supabase = await createClient();

  const { error } = await supabase
    .from("waiver_versions")
    .update({ title: input.title, body: input.body })
    .eq("id", input.id)
    .eq("business_id", membership.business_id)
    .is("published_at", null);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/waivers");
  return { success: true };
}

export async function publishWaiverVersionAction(id: string) {
  const membership = await requireAdminMembership();
  const supabase = await createClient();

  const { error } = await supabase
    .from("waiver_versions")
    .update({ published_at: new Date().toISOString() })
    .eq("id", id)
    .eq("business_id", membership.business_id)
    .is("published_at", null);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/waivers");
  return { success: true };
}

export async function recordWaiverAcceptanceAction(input: {
  clientId: string;
  signatureName: string;
  acceptedByClientId?: string;
}) {
  await requireAdminMembership();
  if (!input.signatureName.trim()) {
    return { error: "The signing name is required" };
  }
  const supabase = await createClient();

  const { error } = await supabase.rpc("record_waiver_acceptance", {
    p_client_id: input.clientId,
    p_signature_name: input.signatureName,
    p_accepted_by_client_id: input.acceptedByClientId ?? null,
  });

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/clients/${input.clientId}`);
  return { success: true };
}

export async function setGuardianAction(input: {
  clientId: string;
  guardianClientId: string | null;
}) {
  const membership = await requireAdminMembership();
  const supabase = await createClient();

  if (input.guardianClientId) {
    // One level only: the guardian must not itself have a guardian, and the
    // dependent must not be a guardian of others.
    const [{ data: guardian }, { count: dependents }] = await Promise.all([
      supabase
        .from("clients")
        .select("guardian_client_id")
        .eq("id", input.guardianClientId)
        .eq("business_id", membership.business_id)
        .maybeSingle(),
      supabase
        .from("clients")
        .select("*", { count: "exact", head: true })
        .eq("guardian_client_id", input.clientId)
        .eq("business_id", membership.business_id),
    ]);
    if (!guardian) return { error: "Guardian not found" };
    if (guardian.guardian_client_id) {
      return { error: "A dependent cannot be a guardian" };
    }
    if ((dependents ?? 0) > 0) {
      return { error: "A guardian cannot become someone's dependent" };
    }
  }

  const { error } = await supabase
    .from("clients")
    .update({ guardian_client_id: input.guardianClientId })
    .eq("id", input.clientId)
    .eq("business_id", membership.business_id);

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/clients/${input.clientId}`);
  return { success: true };
}
