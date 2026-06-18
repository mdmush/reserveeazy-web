import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import {
  isDomainAllowed,
  loadEmbedWidgetContext,
  loadPublicBookingByBusinessId,
} from "@/lib/booking/load-public-booking";
import { BookingWidget } from "@/components/booking/booking-widget";

export default async function EmbedBookingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const context = await loadEmbedWidgetContext(token);

  if (!context) notFound();

  const headersList = await headers();
  const referer = headersList.get("referer");
  const origin = headersList.get("origin");

  if (
    context.allowed_domains.length > 0 &&
    !isDomainAllowed(context.allowed_domains, referer, origin)
  ) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border bg-card p-8 text-center space-y-3 shadow-soft">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-soft text-amber-foreground">
            <ShieldAlert className="h-6 w-6" aria-hidden />
          </div>
          <h1 className="text-lg font-bold text-foreground">
            Widget not authorized
          </h1>
          <p className="text-sm text-muted-foreground">
            This booking widget is not authorized for this website. Contact the
            business owner to add your domain to the allowlist.
          </p>
        </div>
      </div>
    );
  }

  const data = await loadPublicBookingByBusinessId(context.business_id);
  if (!data) notFound();

  const { business, services, staff, slotOptionsByStaffService, appointments } = data;

  return (
    <div className="min-h-0 bg-background py-4 px-3 relative overflow-x-hidden overflow-y-auto">
      <div className="pointer-events-none absolute inset-0 brand-gradient-subtle opacity-40" />
      <main id="main-content" className="relative">
        <BookingWidget
          business={business}
          services={services}
          staff={staff}
          slotOptionsByStaffService={slotOptionsByStaffService}
          appointments={appointments}
        />
      </main>
    </div>
  );
}
