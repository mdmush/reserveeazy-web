import { getUserMembership } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { CalendarView } from "@/components/calendar/calendar-view";
import type {
  Appointment,
  BusinessMember,
  Client,
  Service,
} from "@/types/database";

type AppointmentWithRelations = Appointment & {
  clients: Client | null;
  services: Service | null;
  business_members: BusinessMember | null;
};

export default async function CalendarPage() {
  const membership = await getUserMembership();
  if (!membership) return null;

  const supabase = await createClient();
  const business = membership.businesses;

  const [{ data: appointments }, { data: clients }, { data: services }, { data: staff }, { data: businessHours }] =
    await Promise.all([
      supabase
        .from("appointments")
        .select("*, clients(*), services(*), business_members(*)")
        .eq("business_id", business.id)
        .order("start_at"),
      supabase
        .from("clients")
        .select("*")
        .eq("business_id", business.id)
        .order("full_name"),
      supabase
        .from("services")
        .select("*")
        .eq("business_id", business.id)
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("business_members")
        .select("*")
        .eq("business_id", business.id)
        .eq("is_bookable", true)
        .order("display_name"),
      supabase
        .from("business_hours")
        .select("*")
        .eq("business_id", business.id)
        .order("day_of_week")
        .order("start_time"),
    ]);

  return (
    <CalendarView
      business={business}
      businessHours={businessHours ?? []}
      appointments={(appointments ?? []) as unknown as AppointmentWithRelations[]}
      clients={clients ?? []}
      services={services ?? []}
      staff={staff ?? []}
    />
  );
}
