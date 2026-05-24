import { createClient } from "@/lib/supabase/server";
import type { Business, BusinessMember } from "@/types/database";

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getUserMembership(): Promise<
  (BusinessMember & { businesses: Business }) | null
> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return null;

  const { data } = await supabase
    .from("business_members")
    .select("*, businesses(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data as (BusinessMember & { businesses: Business }) | null;
}

export async function requireMembership() {
  const membership = await getUserMembership();
  if (!membership) {
    throw new Error("No business membership found");
  }
  return membership;
}

export async function isAdmin(role: string) {
  return role === "owner" || role === "admin";
}
