import Link from "next/link";
import { CalendarDays, Users } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { getUserMembership } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { isoOffsetFromNow, nowMs } from "@/lib/clock";
import type { ClassSession } from "@/types/database";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-states";
import { Badge } from "@/components/ui/badge";

type SessionWithType = ClassSession & {
  class_types: { name: string } | null;
};

export default async function TeachPage() {
  const membership = await getUserMembership();
  if (!membership) return null;

  const timezone = membership.businesses.timezone;
  const supabase = await createClient();
  // The teacher's own sessions: from earlier today (attendance marking)
  // through the next two weeks.
  const windowStart = isoOffsetFromNow(-24 * 3600_000);
  const windowEnd = isoOffsetFromNow(14 * 24 * 3600_000);
  const { data } = await supabase
    .from("class_sessions")
    .select("*, class_types(name)")
    .eq("business_id", membership.business_id)
    .eq("teacher_id", membership.id)
    .eq("status", "scheduled")
    .gte("start_at", windowStart)
    .lt("start_at", windowEnd)
    .order("start_at");

  const sessions = (data ?? []) as unknown as SessionWithType[];
  const now = nowMs();

  return (
    <div className="space-y-6">
      <PageHeader
        title="My classes"
        description="Your sessions — tap one to see the roster and mark attendance"
      />

      {!sessions.length ? (
        <EmptyState
          icon={<CalendarDays className="h-10 w-10" />}
          title="No upcoming classes"
          description="Sessions your studio schedules for you will appear here."
        />
      ) : (
        <div className="grid gap-2">
          {sessions.map((session) => {
            const started = new Date(session.start_at).getTime() <= now;
            return (
              <Link
                key={session.id}
                href={`/teach/${session.id}`}
                className="flex items-center justify-between rounded-2xl border bg-card p-4 shadow-soft hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <div>
                  <p className="font-semibold">
                    {session.class_types?.name ?? "Class"}
                    {started && (
                      <Badge variant="success" className="ml-2">
                        Mark attendance
                      </Badge>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatInTimeZone(
                      session.start_at,
                      timezone,
                      "EEE d MMM, h:mm a"
                    )}
                    {session.room ? ` · ${session.room}` : ""}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" aria-hidden />
                  {session.capacity}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
