import { ScrollText } from "lucide-react";
import { getUserMembership } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { getCapabilities } from "@/lib/pricing-mode";
import { WaiversManager } from "@/components/waivers/waivers-manager";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-states";

export default async function WaiversPage() {
  const membership = await getUserMembership();
  if (!membership) return null;

  if (!getCapabilities(membership.businesses.pricing_mode).attendance) {
    return (
      <div className="space-y-6">
        <PageHeader title="Waivers" description="Digital liability waivers" />
        <EmptyState
          icon={<ScrollText className="h-10 w-10" />}
          title="Waivers are part of the membership modes"
          description="Switch this studio to pay-per-class or credit packages in Settings to use digital waivers."
          action={{ label: "Open settings", href: "/dashboard/settings" }}
        />
      </div>
    );
  }

  const supabase = await createClient();
  const { data: versions } = await supabase
    .from("waiver_versions")
    .select("*")
    .eq("business_id", membership.business_id)
    .order("version", { ascending: false });

  return (
    <WaiversManager
      versions={versions ?? []}
      timezone={membership.businesses.timezone}
    />
  );
}
