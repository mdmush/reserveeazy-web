"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMembership, isAdmin } from "@/lib/business";
import { widgetSchema, type WidgetInput } from "@/lib/validations";

function generateEmbedToken() {
  return `ew_${randomBytes(16).toString("hex")}`;
}

function parseAllowedDomains(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

async function requireWidgetAdmin() {
  const membership = await requireMembership();
  if (!(await isAdmin(membership.role))) {
    throw new Error("Admin access required");
  }
  return membership;
}

export async function createWidgetAction(data: WidgetInput) {
  const parsed = widgetSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  try {
    const membership = await requireWidgetAdmin();
    const supabase = await createClient();

    const { error } = await supabase.from("booking_widgets").insert({
      business_id: membership.business_id,
      name: parsed.data.name,
      position: parsed.data.position,
      button_label: parsed.data.buttonLabel,
      allowed_domains: parseAllowedDomains(parsed.data.allowedDomains),
      public_token: generateEmbedToken(),
    });

    if (error) return { error: error.message };
    revalidatePath("/dashboard/widgets");
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unauthorized" };
  }
}

export async function updateWidgetAction(id: string, data: WidgetInput) {
  const parsed = widgetSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  try {
    const membership = await requireWidgetAdmin();
    const supabase = await createClient();

    const { error } = await supabase
      .from("booking_widgets")
      .update({
        name: parsed.data.name,
        position: parsed.data.position,
        button_label: parsed.data.buttonLabel,
        allowed_domains: parseAllowedDomains(parsed.data.allowedDomains),
      })
      .eq("id", id)
      .eq("business_id", membership.business_id);

    if (error) return { error: error.message };
    revalidatePath("/dashboard/widgets");
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unauthorized" };
  }
}

export async function toggleWidgetAction(id: string, isActive: boolean) {
  try {
    const membership = await requireWidgetAdmin();
    const supabase = await createClient();

    const { error } = await supabase
      .from("booking_widgets")
      .update({ is_active: isActive })
      .eq("id", id)
      .eq("business_id", membership.business_id);

    if (error) return { error: error.message };
    revalidatePath("/dashboard/widgets");
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unauthorized" };
  }
}

export async function regenerateWidgetTokenAction(id: string) {
  try {
    const membership = await requireWidgetAdmin();
    const supabase = await createClient();
    const newToken = generateEmbedToken();

    const { error } = await supabase
      .from("booking_widgets")
      .update({ public_token: newToken })
      .eq("id", id)
      .eq("business_id", membership.business_id);

    if (error) return { error: error.message };
    revalidatePath("/dashboard/widgets");
    return { success: true, token: newToken };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unauthorized" };
  }
}

export async function deleteWidgetAction(id: string) {
  try {
    const membership = await requireWidgetAdmin();
    const supabase = await createClient();

    const { error } = await supabase
      .from("booking_widgets")
      .delete()
      .eq("id", id)
      .eq("business_id", membership.business_id);

    if (error) return { error: error.message };
    revalidatePath("/dashboard/widgets");
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unauthorized" };
  }
}
