import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadPublicBookingBySlug } from "@/lib/booking/load-public-booking";
import { BookingWidget } from "@/components/booking/booking-widget";

const getPublicBooking = cache(loadPublicBookingBySlug);

// The public booking page is the one indexable surface on app.cusp.my;
// everything else inherits noindex from the root layout.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublicBooking(slug);
  if (!data) return { robots: { index: false, follow: false } };
  return {
    title: `Book with ${data.business.name} — CUSP`,
    description: `Book an appointment with ${data.business.name} online.`,
    robots: { index: true, follow: true },
  };
}

export default async function PublicBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getPublicBooking(slug);

  if (!data) notFound();

  const { business, services, staff, slotOptionsByStaffService, appointments } = data;

  return (
    <div className="mesh-bg min-h-screen py-10 px-4 relative overflow-hidden">
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
          <a
            href="https://www.cusp.my"
            className="text-primary hover:underline font-medium"
          >
            CUSP
          </a>
        </p>
      </main>
    </div>
  );
}
