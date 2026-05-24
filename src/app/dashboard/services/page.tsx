import { getUserMembership } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { ServicesManager } from "@/components/dashboard/services-manager";

export default async function ServicesPage() {
  const membership = await getUserMembership();
  if (!membership) return null;

  const supabase = await createClient();
  const { data: services } = await supabase
    .from("services")
    .select("*")
    .eq("business_id", membership.business_id)
    .order("sort_order", { ascending: true });

  return <ServicesManager services={services ?? []} />;
}
