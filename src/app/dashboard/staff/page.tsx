import { getUserMembership } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { getCapabilities } from "@/lib/pricing-mode";
import { StaffManager } from "@/components/dashboard/staff-manager";
import type { BusinessMember, StaffAvailability } from "@/types/database";

type StaffWithRelations = BusinessMember & {
  staff_services: { service_id: string }[];
  staff_availability: StaffAvailability[];
};

export default async function StaffPage() {
  const membership = await getUserMembership();
  if (!membership) return null;

  const capabilities = getCapabilities(membership.businesses.pricing_mode);
  const supabase = await createClient();
  const [{ data: staff }, { data: services }, { data: classTypes }, { data: rates }] =
    await Promise.all([
      supabase
        .from("business_members")
        .select("*, staff_services(service_id), staff_availability(*)")
        .eq("business_id", membership.business_id)
        .order("created_at", { ascending: true }),
      supabase
        .from("services")
        .select("*")
        .eq("business_id", membership.business_id)
        .eq("is_active", true)
        .order("sort_order"),
      capabilities.commission
        ? supabase
            .from("class_types")
            .select("*")
            .eq("business_id", membership.business_id)
            .eq("is_active", true)
            .order("sort_order")
        : Promise.resolve({ data: [] }),
      capabilities.commission
        ? supabase
            .from("commission_rates")
            .select("*")
            .eq("business_id", membership.business_id)
        : Promise.resolve({ data: [] }),
    ]);

  return (
    <StaffManager
      staff={(staff ?? []) as unknown as StaffWithRelations[]}
      services={services ?? []}
      classTypes={classTypes ?? []}
      commissionRates={rates ?? []}
      showCommission={capabilities.commission}
    />
  );
}
