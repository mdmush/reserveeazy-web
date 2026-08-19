import { requireMemberClient, getActingClients } from "@/lib/member";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  BookingsList,
  type MemberBookingRow,
} from "@/components/portal/bookings-list";

export default async function MemberBookingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const context = await requireMemberClient(slug);
  const supabase = await createClient();

  const { data } = await supabase.rpc("get_member_bookings", {
    p_business_id: context.business.id,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="My bookings"
        description="Upcoming classes and your history"
      />
      <BookingsList
        slug={slug}
        bookings={(data ?? []) as unknown as MemberBookingRow[]}
        showClientNames={getActingClients(context).length > 1}
        timezone={context.business.timezone}
      />
    </div>
  );
}
