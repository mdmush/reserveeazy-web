"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPostAuthRedirectPath } from "@/lib/superuser";
import { getAppUrl } from "@/lib/app-url";
import {
  loginSchema,
  signupSchema,
  onboardingSchema,
  type LoginInput,
  type SignupInput,
  type OnboardingInput,
} from "@/lib/validations";

export async function loginAction(data: LoginInput) {
  const parsed = loginSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) return { error: error.message };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Authentication failed" };

  redirect(await getPostAuthRedirectPath());
}

export async function signupAction(data: SignupInput) {
  const parsed = signupSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${getAppUrl()}/auth/confirm`,
    },
  });

  if (error) return { error: error.message };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(await getPostAuthRedirectPath());
  }

  redirect("/onboarding");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function onboardingAction(data: OnboardingInput) {
  const parsed = onboardingSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const { data: existingMember } = await supabase
    .from("business_members")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingMember) {
    redirect("/dashboard");
  }

  // Creation is atomic in the create_business RPC (SECURITY DEFINER): the
  // membership-scoped SELECT policies mean a not-yet-member cannot check slug
  // uniqueness or read back an inserted business row from the client.
  const { error: createError } = await supabase.rpc("create_business", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
    p_business_type: parsed.data.businessType,
    p_timezone: parsed.data.timezone,
    p_owner_name: parsed.data.name,
  });

  if (createError) return { error: createError.message };

  redirect("/dashboard");
}
