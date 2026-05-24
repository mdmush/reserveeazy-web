"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

  const { data: membership } = await supabase
    .from("business_members")
    .select("id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  redirect(membership ? "/dashboard" : "/onboarding");
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
    },
  });

  if (error) return { error: error.message };
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

  const { data: existingSlug } = await supabase
    .from("businesses")
    .select("id")
    .eq("slug", parsed.data.slug)
    .maybeSingle();

  if (existingSlug) {
    return { error: "This booking URL is already taken. Choose another slug." };
  }

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .insert({
      name: parsed.data.name,
      slug: parsed.data.slug,
      business_type: parsed.data.businessType,
      timezone: parsed.data.timezone,
    })
    .select("id")
    .single();

  if (businessError) return { error: businessError.message };

  const { error: memberError } = await supabase.from("business_members").insert({
    business_id: business.id,
    user_id: user.id,
    display_name: parsed.data.name,
    email: user.email,
    role: "owner",
    is_bookable: true,
  });

  if (memberError) return { error: memberError.message };

  redirect("/dashboard");
}
