import { getUserMembership } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/dashboard/settings-form";
import type { BusinessHours } from "@/types/database";

export default async function SettingsPage() {
  const membership = await getUserMembership();
  if (!membership) return null;

  const supabase = await createClient();
  const { data: businessHours } = await supabase
    .from("business_hours")
    .select("*")
    .eq("business_id", membership.business_id)
    .order("day_of_week")
    .order("start_time");

  return (
    <SettingsForm
      business={membership.businesses}
      businessHours={(businessHours ?? []) as BusinessHours[]}
    />
  );
}
