import { getUserMembership } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { ClientsList } from "@/components/dashboard/clients-list";

export default async function ClientsPage() {
  const membership = await getUserMembership();
  if (!membership) return null;

  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .eq("business_id", membership.business_id)
    .order("full_name");

  return <ClientsList clients={clients ?? []} />;
}
