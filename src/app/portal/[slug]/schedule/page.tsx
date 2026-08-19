import { addDays, format, parseISO } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { requireMemberClient, getActingClients } from "@/lib/member";
import { createClient } from "@/lib/supabase/server";
import type { PackageInstance } from "@/types/database";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  MemberSchedule,
  type MemberSession,
  type MemberInstance,
} from "@/components/portal/member-schedule";

export default async function MemberSchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const { slug } = await params;
  const context = await requireMemberClient(slug);
  const { business } = context;
  const timezone = business.timezone;

  const { week } = await searchParams;
  const todayLocal = format(toZonedTime(new Date(), timezone), "yyyy-MM-dd");
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(week ?? "") ? (week as string) : todayLocal;
  const anchorDate = parseISO(anchor);
  const mondayOffset = (anchorDate.getUTCDay() + 6) % 7;
  const weekStart = format(addDays(anchorDate, -mondayOffset), "yyyy-MM-dd");

  const rangeStart = fromZonedTime(`${weekStart}T00:00:00`, timezone);
  const rangeEnd = fromZonedTime(
    `${format(addDays(parseISO(weekStart), 7), "yyyy-MM-dd")}T00:00:00`,
    timezone
  );

  const supabase = await createClient();
  const acting = getActingClients(context);
  const actingIds = acting.map((c) => c.id);

  const [{ data: schedule }, { data: instances }, { data: balances }, { data: packages }] =
    await Promise.all([
      supabase.rpc("get_member_schedule", {
        p_business_id: business.id,
        p_from: rangeStart.toISOString(),
        p_to: rangeEnd.toISOString(),
      }),
      supabase
        .from("package_instances")
        .select("*")
        .in("client_id", actingIds),
      supabase
        .from("package_instance_balances")
        .select("*")
        .in("client_id", actingIds),
      supabase.from("packages").select("id, name").eq("business_id", business.id),
    ]);

  const balanceByInstance = new Map(
    (balances ?? []).map((b) => [b.package_instance_id, b.balance])
  );
  const packageNames = new Map((packages ?? []).map((p) => [p.id, p.name]));
  const memberInstances: MemberInstance[] = (
    (instances ?? []) as PackageInstance[]
  ).map((instance) => ({
    ...instance,
    balance: balanceByInstance.get(instance.id) ?? 0,
    packageName: packageNames.get(instance.package_id) ?? "Package",
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Schedule" description="Tap a class to book your spot" />
      <MemberSchedule
        slug={slug}
        sessions={(schedule ?? []) as unknown as MemberSession[]}
        instances={memberInstances}
        actingClients={acting.map((c) => ({ id: c.id, full_name: c.full_name }))}
        selfClientId={context.client.id}
        pricingMode={business.pricing_mode}
        weekStart={weekStart}
        todayLocal={todayLocal}
        timezone={timezone}
      />
    </div>
  );
}
