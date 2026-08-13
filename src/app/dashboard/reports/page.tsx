import { addMonths, format, parseISO } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { BarChart3, Clock, Users, CalendarCheck } from "lucide-react";
import { getUserMembership } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/shell/stat-card";
import { LinkButton } from "@/components/ui/link-button";
import {
  InstructorHours,
  formatHours,
  type InstructorHoursRow,
} from "@/components/reports/instructor-hours";
import {
  MemberSessions,
  type MemberSessionsRow,
} from "@/components/reports/member-sessions";

// Mode-A session semantics: with no attendance tracking yet, confirmed and
// completed appointments ARE the session record. When attendance lands (modes
// B/C), these reports switch to attendance rows via the pricing-mode
// capability map — the shape stays the same.
const SESSION_STATUSES = ["confirmed", "completed"] as const;

type AppointmentRow = {
  start_at: string;
  end_at: string;
  staff_member_id: string;
  client_id: string;
  business_members: { display_name: string } | null;
  clients: { full_name: string } | null;
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const membership = await getUserMembership();
  if (!membership) return null;

  const business = membership.businesses;
  const timezone = business.timezone;

  const { month: monthParam } = await searchParams;
  const currentMonth = format(toZonedTime(new Date(), timezone), "yyyy-MM");
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam ?? "")
    ? (monthParam as string)
    : currentMonth;

  // Month boundaries in the studio's timezone, converted to UTC instants.
  const monthStart = fromZonedTime(`${month}-01T00:00:00`, timezone);
  const nextMonth = format(addMonths(parseISO(`${month}-01`), 1), "yyyy-MM");
  const prevMonth = format(addMonths(parseISO(`${month}-01`), -1), "yyyy-MM");
  const monthEnd = fromZonedTime(`${nextMonth}-01T00:00:00`, timezone);

  const supabase = await createClient();
  const { data } = await supabase
    .from("appointments")
    .select(
      "start_at, end_at, staff_member_id, client_id, business_members(display_name), clients(full_name)"
    )
    .eq("business_id", business.id)
    .gte("start_at", monthStart.toISOString())
    .lt("start_at", monthEnd.toISOString())
    .in("status", [...SESSION_STATUSES]);

  const rows = (data ?? []) as unknown as AppointmentRow[];

  const byStaff = new Map<string, InstructorHoursRow>();
  const byClient = new Map<string, MemberSessionsRow>();

  for (const appt of rows) {
    const minutes =
      (parseISO(appt.end_at).getTime() - parseISO(appt.start_at).getTime()) /
      60_000;

    const staffRow = byStaff.get(appt.staff_member_id) ?? {
      staffMemberId: appt.staff_member_id,
      displayName: appt.business_members?.display_name ?? "Unknown",
      sessions: 0,
      minutes: 0,
    };
    staffRow.sessions += 1;
    staffRow.minutes += minutes;
    byStaff.set(appt.staff_member_id, staffRow);

    const clientRow = byClient.get(appt.client_id) ?? {
      clientId: appt.client_id,
      fullName: appt.clients?.full_name ?? "Unknown",
      sessions: 0,
    };
    clientRow.sessions += 1;
    byClient.set(appt.client_id, clientRow);
  }

  const instructorRows = [...byStaff.values()].sort(
    (a, b) => b.minutes - a.minutes
  );
  const memberRows = [...byClient.values()].sort(
    (a, b) => b.sessions - a.sessions
  );
  const totalMinutes = instructorRows.reduce((sum, r) => sum + r.minutes, 0);
  const totalSessions = rows.length;
  const monthLabel = format(parseISO(`${month}-01`), "MMMM yyyy");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Instructor hours and member session usage, per month"
      />

      <div className="flex items-center gap-2">
        <LinkButton
          variant="outline"
          size="sm"
          href={`/dashboard/reports?month=${prevMonth}`}
        >
          ← {format(parseISO(`${prevMonth}-01`), "MMM yyyy")}
        </LinkButton>
        <span className="px-2 text-sm font-semibold">{monthLabel}</span>
        {month < currentMonth && (
          <LinkButton
            variant="outline"
            size="sm"
            href={`/dashboard/reports?month=${nextMonth}`}
          >
            {format(parseISO(`${nextMonth}-01`), "MMM yyyy")} →
          </LinkButton>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total hours"
          tone="primary"
          icon={Clock}
          value={formatHours(totalMinutes)}
        />
        <StatCard
          title="Sessions"
          tone="blue"
          icon={CalendarCheck}
          value={totalSessions}
        />
        <StatCard
          title="Active instructors"
          tone="teal"
          icon={BarChart3}
          value={instructorRows.length}
        />
        <StatCard
          title="Active members"
          tone="violet"
          icon={Users}
          value={memberRows.length}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <InstructorHours rows={instructorRows} month={month} />
        <MemberSessions rows={memberRows} month={month} />
      </div>

      <p className="text-xs text-muted-foreground">
        Sessions count confirmed and completed appointments; cancelled and
        no-show appointments are excluded. Months follow the studio timezone (
        {timezone}).
      </p>
    </div>
  );
}
