import { CalendarDays } from "lucide-react";
import { addDays, format, parseISO } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { getUserMembership } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { getCapabilities } from "@/lib/pricing-mode";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-states";
import {
  ScheduleManager,
  type SessionWithRelations,
} from "@/components/classes/schedule-manager";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const membership = await getUserMembership();
  if (!membership) return null;

  const business = membership.businesses;
  if (!getCapabilities(business.pricing_mode).attendance) {
    return (
      <div className="space-y-6">
        <PageHeader title="Schedule" description="Weekly class sessions" />
        <EmptyState
          icon={<CalendarDays className="h-10 w-10" />}
          title="Scheduling is part of the membership modes"
          description="Switch this studio to pay-per-class or credit packages in Settings to schedule group classes."
          action={{ label: "Open settings", href: "/dashboard/settings" }}
        />
      </div>
    );
  }

  const timezone = business.timezone;
  const { week } = await searchParams;

  // Snap to Monday of the requested (or current) week, in studio-local days.
  const todayLocal = format(toZonedTime(new Date(), timezone), "yyyy-MM-dd");
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(week ?? "")
    ? (week as string)
    : todayLocal;
  const anchorDate = parseISO(anchor);
  const mondayOffset = (anchorDate.getUTCDay() + 6) % 7;
  const weekStart = format(addDays(anchorDate, -mondayOffset), "yyyy-MM-dd");
  const weekDays = Array.from({ length: 7 }, (_, i) =>
    format(addDays(parseISO(weekStart), i), "yyyy-MM-dd")
  );

  const rangeStart = fromZonedTime(`${weekStart}T00:00:00`, timezone);
  const rangeEnd = fromZonedTime(
    `${format(addDays(parseISO(weekStart), 7), "yyyy-MM-dd")}T00:00:00`,
    timezone
  );

  const supabase = await createClient();
  const [{ data: sessions }, { data: classTypes }, { data: teachers }] =
    await Promise.all([
      supabase
        .from("class_sessions")
        .select("*, class_types(name, color), business_members(display_name)")
        .eq("business_id", business.id)
        .gte("start_at", rangeStart.toISOString())
        .lt("start_at", rangeEnd.toISOString())
        .order("start_at"),
      supabase
        .from("class_types")
        .select("*")
        .eq("business_id", business.id)
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("business_members")
        .select("id, display_name")
        .eq("business_id", business.id)
        .eq("is_bookable", true)
        .order("display_name"),
    ]);

  return (
    <ScheduleManager
      sessions={(sessions ?? []) as unknown as SessionWithRelations[]}
      classTypes={classTypes ?? []}
      teachers={teachers ?? []}
      weekStart={weekStart}
      weekDays={weekDays}
      todayLocal={todayLocal}
      timezone={timezone}
    />
  );
}
