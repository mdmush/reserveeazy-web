import { notFound } from "next/navigation";
import { loadPublicBookingBySlug } from "@/lib/booking/load-public-booking";
import { BookingWidget } from "@/components/booking/booking-widget";

export default async function PublicBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await loadPublicBookingBySlug(slug);

  if (!data) notFound();

  const { business, services, staff, slotOptionsByStaffService, appointments } = data;

  return (
    <div className="min-h-screen bg-background py-8 px-4 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 brand-gradient-subtle opacity-40" />
      <main id="main-content" className="relative">
        <BookingWidget
          business={business}
          services={services}
          staff={staff}
          slotOptionsByStaffService={slotOptionsByStaffService}
          appointments={appointments}
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
