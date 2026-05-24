import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/business";

export async function getIsSuperuser(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("is_superuser")
    .eq("id", user.id)
    .maybeSingle();

  return data?.is_superuser ?? false;
}

export async function requireSuperuser() {
  const isSuperuser = await getIsSuperuser();
  if (!isSuperuser) {
    redirect("/dashboard");
  }
}

export async function getPostAuthRedirectPath(): Promise<string> {
  const user = await getCurrentUser();
  if (!user) return "/login";

  const supabase = await createClient();

  const [{ data: membership }, { data: profile }] = await Promise.all([
    supabase
      .from("business_members")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("is_superuser")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  if (membership) return "/dashboard";
  if (profile?.is_superuser) return "/admin";
  return "/onboarding";
}
