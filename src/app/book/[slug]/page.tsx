import { notFound } from "next/navigation";
import { addDays, format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { generateSlots } from "@/lib/booking/slots";
import { BookingWidget } from "@/components/booking/booking-widget";
import type { BusinessMember, StaffAvailability } from "@/types/database";

type StaffWithRelations = BusinessMember & {
  staff_services: { service_id: string }[];
  staff_availability: StaffAvailability[];
};

export default async function PublicBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!business) notFound();

  const [{ data: services }, { data: staff }, { data: appointments }] =
    await Promise.all([
      supabase
        .from("services")
        .select("*")
        .eq("business_id", business.id)
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("business_members")
        .select("*, staff_services(service_id), staff_availability(*)")
        .eq("business_id", business.id)
        .eq("is_bookable", true),
      supabase
        .from("appointments")
        .select("start_at, end_at, status, staff_member_id")
        .eq("business_id", business.id)
        .gte("start_at", new Date().toISOString())
        .neq("status", "cancelled"),
    ]);

  const bookableStaff = (staff ?? []) as unknown as StaffWithRelations[];
  const activeServices = services ?? [];
  const allAppointments = appointments ?? [];

  const slotsByStaff: Record<string, string[]> = {};
  const dateRange = Array.from({ length: 14 }, (_, i) =>
    format(addDays(new Date(), i), "yyyy-MM-dd")
  );

  for (const member of bookableStaff) {
    const memberAppointments = allAppointments.filter(
      (a) => a.staff_member_id === member.id
    );

    const { data: timeOff } = await supabase
      .from("staff_time_off")
      .select("start_at, end_at")
      .eq("staff_member_id", member.id)
      .gte("end_at", new Date().toISOString());

    const allSlots: string[] = [];

    for (const service of activeServices) {
      if (!member.staff_services?.some((ss) => ss.service_id === service.id)) {
        continue;
      }
      for (const date of dateRange) {
        const daySlots = generateSlots({
          date,
          timezone: business.timezone,
          serviceDurationMinutes: service.duration_minutes,
          settings: business.settings,
          availability: member.staff_availability ?? [],
          appointments: memberAppointments,
          timeOff: timeOff ?? [],
        });
        allSlots.push(...daySlots);
      }
    }

    slotsByStaff[member.id] = [...new Set(allSlots)].sort();
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 brand-gradient-subtle opacity-40" />
      <main id="main-content" className="relative">
        <BookingWidget
          business={business}
          services={activeServices}
          staff={bookableStaff}
          slotsByStaff={slotsByStaff}
          appointments={allAppointments}
        />
        <p className="text-center text-xs text-muted-foreground mt-8">
          Powered by{" "}
          <a href="/" className="text-primary hover:underline font-medium">
            ReserveEazy
          </a>
        </p>
      </main>
    </div>
  );
}
