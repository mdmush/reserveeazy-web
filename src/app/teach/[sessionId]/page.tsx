import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { getUserMembership } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/page-header";
import { LinkButton } from "@/components/ui/link-button";
import {
  SessionRoster,
  type RosterBooking,
} from "@/components/classes/session-roster";

export default async function TeachSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const membership = await getUserMembership();
  if (!membership) return null;

  const { sessionId } = await params;
  const supabase = await createClient();
  const { data: session } = await supabase
    .from("class_sessions")
    .select("*, class_types(id, name, credit_cost)")
    .eq("id", sessionId)
    .eq("business_id", membership.business_id)
    .eq("teacher_id", membership.id) // teachers see only their own sessions
    .maybeSingle();

  if (!session) notFound();

  const classType = (
    session as unknown as {
      class_types: { id: string; name: string; credit_cost: number } | null;
    }
  ).class_types;
  const timezone = membership.businesses.timezone;

  const { data: bookings } = await supabase
    .from("bookings")
    .select("*, clients(full_name, phone)")
    .eq("class_session_id", sessionId)
    .eq("business_id", membership.business_id)
    .order("created_at");

  return (
    <div className="space-y-6">
      <div>
        <LinkButton variant="ghost" size="sm" href="/teach">
          <ArrowLeft className="h-4 w-4 mr-1.5" aria-hidden />
          My classes
        </LinkButton>
      </div>
      <PageHeader
        title={classType?.name ?? "Class"}
        description={`${formatInTimeZone(
          session.start_at,
          timezone,
          "EEEE d MMM yyyy, h:mm a"
        )} – ${formatInTimeZone(session.end_at, timezone, "h:mm a")}${
          session.room ? ` · ${session.room}` : ""
        }`}
      />

      <SessionRoster
        mode="teacher"
        sessionId={sessionId}
        sessionInfo={{
          className: classType?.name ?? "Class",
          startAt: session.start_at,
          studioName: membership.businesses.name,
        }}
        capacity={session.capacity}
        classTypeId={classType?.id ?? ""}
        classTypeCreditCost={classType?.credit_cost ?? 10}
        cutoffHours={24}
        bookings={(bookings ?? []) as unknown as RosterBooking[]}
        clients={[]}
        instances={[]}
        timezone={timezone}
      />
    </div>
  );
}
