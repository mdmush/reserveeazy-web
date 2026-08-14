import { notFound } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { getUserMembership } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import type { PackageInstance } from "@/types/database";
import { PageHeader } from "@/components/dashboard/page-header";
import { LinkButton } from "@/components/ui/link-button";
import { Badge } from "@/components/ui/badge";
import {
  SessionRoster,
  type RosterBooking,
  type RosterInstance,
} from "@/components/classes/session-roster";

export default async function SessionRosterPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const membership = await getUserMembership();
  if (!membership) return null;

  const { sessionId } = await params;
  const business = membership.businesses;
  const supabase = await createClient();

  const { data: session } = await supabase
    .from("class_sessions")
    .select("*, class_types(id, name, credit_cost), business_members(display_name)")
    .eq("id", sessionId)
    .eq("business_id", membership.business_id)
    .maybeSingle();

  if (!session) notFound();

  const relations = session as unknown as {
    class_types: { id: string; name: string; credit_cost: number } | null;
    business_members: { display_name: string } | null;
  };
  const classType = relations.class_types;
  const teacherName = relations.business_members?.display_name ?? "—";
  const timezone = business.timezone;

  const [
    { data: bookings },
    { data: clients },
    { data: instances },
    { data: balances },
    { data: packages },
    { data: passes },
  ] = await Promise.all([
    supabase
      .from("bookings")
      .select("*, clients(full_name, phone)")
      .eq("class_session_id", sessionId)
      .eq("business_id", membership.business_id)
      .order("created_at"),
    supabase
      .from("clients")
      .select("id, full_name")
      .eq("business_id", membership.business_id)
      .order("full_name"),
    supabase
      .from("package_instances")
      .select("*")
      .eq("business_id", membership.business_id),
    supabase
      .from("package_instance_balances")
      .select("*")
      .eq("business_id", membership.business_id),
    supabase
      .from("packages")
      .select("id, name")
      .eq("business_id", membership.business_id),
    supabase
      .from("grace_passes")
      .select("*")
      .eq("business_id", membership.business_id)
      .eq("status", "available"),
  ]);

  const balanceByInstance = new Map(
    (balances ?? []).map((b) => [b.package_instance_id, b.balance])
  );
  const packageNames = new Map((packages ?? []).map((p) => [p.id, p.name]));
  const rosterInstances: RosterInstance[] = (
    (instances ?? []) as PackageInstance[]
  ).map((instance) => ({
    ...instance,
    balance: balanceByInstance.get(instance.id) ?? 0,
    packageName: packageNames.get(instance.package_id) ?? "Package",
  }));

  const cutoffHours =
    (business.settings as { cancellation_cutoff_hours?: number })
      .cancellation_cutoff_hours ?? 24;

  return (
    <div className="space-y-6">
      <div>
        <LinkButton variant="ghost" size="sm" href="/dashboard/schedule">
          <ArrowLeft className="h-4 w-4 mr-1.5" aria-hidden />
          Schedule
        </LinkButton>
      </div>
      <PageHeader
        title={classType?.name ?? "Class"}
        description={`${formatInTimeZone(
          session.start_at,
          timezone,
          "EEEE d MMM yyyy, h:mm a"
        )} – ${formatInTimeZone(session.end_at, timezone, "h:mm a")} · ${teacherName}${
          session.room ? ` · ${session.room}` : ""
        }`}
      />
      {session.status === "cancelled" && (
        <Badge variant="secondary">Cancelled</Badge>
      )}

      <SessionRoster
        sessionId={sessionId}
        sessionInfo={{
          className: classType?.name ?? "Class",
          startAt: session.start_at,
          studioName: business.name,
        }}
        capacity={session.capacity}
        classTypeId={classType?.id ?? ""}
        classTypeCreditCost={classType?.credit_cost ?? 10}
        cutoffHours={cutoffHours}
        bookings={(bookings ?? []) as unknown as RosterBooking[]}
        clients={clients ?? []}
        instances={rosterInstances}
        passes={passes ?? []}
        timezone={timezone}
      />
    </div>
  );
}
