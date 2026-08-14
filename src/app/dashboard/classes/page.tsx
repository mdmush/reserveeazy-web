import { Sparkles } from "lucide-react";
import { getUserMembership } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { getCapabilities } from "@/lib/pricing-mode";
import { ClassTypesManager } from "@/components/classes/class-types-manager";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-states";

export default async function ClassesPage() {
  const membership = await getUserMembership();
  if (!membership) return null;

  if (!getCapabilities(membership.businesses.pricing_mode).attendance) {
    return (
      <div className="space-y-6">
        <PageHeader title="Classes" description="Group classes and credit costs" />
        <EmptyState
          icon={<Sparkles className="h-10 w-10" />}
          title="Classes are part of the membership modes"
          description="Switch this studio to pay-per-class or credit packages in Settings to schedule group classes."
          action={{ label: "Open settings", href: "/dashboard/settings" }}
        />
      </div>
    );
  }

  const supabase = await createClient();
  const { data: classTypes } = await supabase
    .from("class_types")
    .select("*")
    .eq("business_id", membership.business_id)
    .order("sort_order", { ascending: true });

  return <ClassTypesManager classTypes={classTypes ?? []} />;
}
