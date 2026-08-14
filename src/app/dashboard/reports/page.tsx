import { addMonths, format, parseISO } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import {
  BarChart3,
  Clock,
  Users,
  CalendarCheck,
  BadgeDollarSign,
} from "lucide-react";
import { getUserMembership } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { getCapabilities } from "@/lib/pricing-mode";
import { nowMs } from "@/lib/clock";
import { formatPrice } from "@/lib/format";
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
import {
  CommissionReport,
  type CommissionRow,
} from "@/components/reports/commission-report";

// Mode-A session semantics: with no attendance tracking, confirmed and
// completed appointments ARE the session record. Modes B/C use attendance
// (bookings.status = 'attended') and the commission-event ledger instead.
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
  const capabilities = getCapabilities(business.pricing_mode);

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
  const monthLabel = format(parseISO(`${month}-01`), "MMMM yyyy");

  const supabase = await createClient();

  let statCards: React.ReactNode;
  let reportSections: React.ReactNode;
  let footnote: string;

  if (capabilities.attendance) {
    // ---- Modes B/C: attendance + commission ------------------------------
    const [
      { data: sessions },
      { data: attended },
      { data: events },
      { data: dues },
    ] = await Promise.all([
      supabase
        .from("class_sessions")
        .select("id, teacher_id, start_at, end_at, business_members(display_name)")
        .eq("business_id", business.id)
        .eq("status", "scheduled")
        .gte("start_at", monthStart.toISOString())
        .lt("start_at", monthEnd.toISOString()),
      supabase
        .from("bookings")
        .select(
          "client_id, clients(full_name), class_sessions!inner(teacher_id, start_at)"
        )
        .eq("business_id", business.id)
        .eq("status", "attended")
        .gte("class_sessions.start_at", monthStart.toISOString())
        .lt("class_sessions.start_at", monthEnd.toISOString()),
      supabase
        .from("commission_events")
        .select("teacher_id, rate_snapshot_cents")
        .eq("business_id", business.id)
        .gte("occurred_at", monthStart.toISOString())
        .lt("occurred_at", monthEnd.toISOString()),
      business.pricing_mode === "pay_per_class"
        ? supabase
            .from("payment_dues")
            .select("client_id, amount_cents, status")
            .eq("business_id", business.id)
            .gte("created_at", monthStart.toISOString())
            .lt("created_at", monthEnd.toISOString())
        : Promise.resolve({ data: [] as { client_id: string; amount_cents: number; status: string }[] }),
    ]);

    type SessionRow = {
      id: string;
      teacher_id: string;
      start_at: string;
      end_at: string;
      business_members: { display_name: string } | null;
    };
    type AttendedRow = {
      client_id: string;
      clients: { full_name: string } | null;
      class_sessions: { teacher_id: string; start_at: string } | null;
    };

    const now = nowMs();
    const pastSessions = ((sessions ?? []) as unknown as SessionRow[]).filter(
      (s) => new Date(s.start_at).getTime() <= now
    );
    const attendedRows = (attended ?? []) as unknown as AttendedRow[];

    const byTeacher = new Map<string, CommissionRow>();
    for (const session of pastSessions) {
      const row = byTeacher.get(session.teacher_id) ?? {
        teacherId: session.teacher_id,
        displayName: session.business_members?.display_name ?? "Unknown",
        classesTaught: 0,
        attendedHeadcount: 0,
        minutesTaught: 0,
        commissionCents: 0,
      };
      row.classesTaught += 1;
      row.minutesTaught +=
        (new Date(session.end_at).getTime() -
          new Date(session.start_at).getTime()) /
        60_000;
      byTeacher.set(session.teacher_id, row);
    }
    for (const row of attendedRows) {
      const teacherId = row.class_sessions?.teacher_id;
      if (!teacherId) continue;
      const teacher = byTeacher.get(teacherId);
      if (teacher) teacher.attendedHeadcount += 1;
    }
    for (const event of events ?? []) {
      const teacher = byTeacher.get(event.teacher_id);
      if (teacher) teacher.commissionCents += event.rate_snapshot_cents;
    }
    const commissionRows = [...byTeacher.values()].sort(
      (a, b) => b.commissionCents - a.commissionCents
    );

    const byClient = new Map<string, MemberSessionsRow>();
    for (const row of attendedRows) {
      const entry = byClient.get(row.client_id) ?? {
        clientId: row.client_id,
        fullName: row.clients?.full_name ?? "Unknown",
        sessions: 0,
        outstandingDueCents: 0,
      };
      entry.sessions += 1;
      byClient.set(row.client_id, entry);
    }
    for (const due of dues ?? []) {
      if (due.status !== "due") continue;
      const entry = byClient.get(due.client_id);
      if (entry) {
        entry.outstandingDueCents =
          (entry.outstandingDueCents ?? 0) + due.amount_cents;
      }
    }
    const memberRows = [...byClient.values()].sort(
      (a, b) => b.sessions - a.sessions
    );

    const totalMinutes = commissionRows.reduce((s, r) => s + r.minutesTaught, 0);
    const totalCommission = commissionRows.reduce(
      (s, r) => s + r.commissionCents,
      0
    );

    statCards = (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Hours taught"
          tone="primary"
          icon={Clock}
          value={formatHours(totalMinutes)}
        />
        <StatCard
          title="Attendances"
          tone="blue"
          icon={CalendarCheck}
          value={attendedRows.length}
        />
        <StatCard
          title="Commission"
          tone="teal"
          icon={BadgeDollarSign}
          value={formatPrice(totalCommission, "MYR")}
        />
        <StatCard
          title="Active members"
          tone="violet"
          icon={Users}
          value={memberRows.length}
        />
      </div>
    );
    reportSections = (
      <div className="grid gap-6 lg:grid-cols-2">
        <CommissionReport rows={commissionRows} month={month} />
        <MemberSessions
          rows={memberRows}
          month={month}
          showDues={business.pricing_mode === "pay_per_class"}
        />
      </div>
    );
    footnote =
      "Sessions count attendance marked by teachers or admins; commission sums rate snapshots recorded at attendance time (reversals net out).";
  } else {
    // ---- Mode A: appointment-derived (original behavior) -----------------
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

    statCards = (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total hours"
          tone="primary"
          icon={Clock}
          value={formatHours(totalMinutes)}
        />
        <StatCard title="Sessions" tone="blue" icon={CalendarCheck} value={rows.length} />
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
    );
    reportSections = (
      <div className="grid gap-6 lg:grid-cols-2">
        <InstructorHours rows={instructorRows} month={month} />
        <MemberSessions rows={memberRows} month={month} />
      </div>
    );
    footnote =
      "Sessions count confirmed and completed appointments; cancelled and no-show appointments are excluded.";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Instructor hours, member usage, and commission per month"
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

      {statCards}
      {reportSections}

      <p className="text-xs text-muted-foreground">
        {footnote} Months follow the studio timezone ({timezone}).
      </p>
    </div>
  );
}
