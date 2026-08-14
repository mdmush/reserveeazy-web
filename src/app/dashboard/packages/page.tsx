import { Package } from "lucide-react";
import { getUserMembership } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { getCapabilities } from "@/lib/pricing-mode";
import { PackagesManager } from "@/components/packages/packages-manager";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-states";

export default async function PackagesPage() {
  const membership = await getUserMembership();
  if (!membership) return null;

  if (!getCapabilities(membership.businesses.pricing_mode).credits) {
    return (
      <div className="space-y-6">
        <PageHeader title="Packages" description="Credit packages" />
        <EmptyState
          icon={<Package className="h-10 w-10" />}
          title="Packages need the credit engine"
          description="Switch this studio to the credit packages pricing mode in Settings to sell class credits."
          action={{ label: "Open settings", href: "/dashboard/settings" }}
        />
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: packages }, { data: classTypes }, { data: clients }] =
    await Promise.all([
      supabase
        .from("packages")
        .select("*")
        .eq("business_id", membership.business_id)
        .order("sort_order"),
      supabase
        .from("class_types")
        .select("*")
        .eq("business_id", membership.business_id)
        .order("sort_order"),
      supabase
        .from("clients")
        .select("id, full_name")
        .eq("business_id", membership.business_id)
        .order("full_name"),
    ]);

  return (
    <PackagesManager
      packages={packages ?? []}
      classTypes={classTypes ?? []}
      clients={clients ?? []}
    />
  );
}
