import { getUserMembership } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/app-url";
import { WidgetsManager } from "@/components/dashboard/widgets-manager";

export default async function WidgetsPage() {
  const membership = await getUserMembership();
  if (!membership) return null;

  const supabase = await createClient();
  const { data: widgets } = await supabase
    .from("booking_widgets")
    .select("*")
    .eq("business_id", membership.business_id)
    .order("created_at", { ascending: false });

  return (
    <WidgetsManager widgets={widgets ?? []} appUrl={getAppUrl()} />
  );
}
