import { format, parseISO } from "date-fns";
import { Scissors, Users, ExternalLink, CalendarClock } from "lucide-react";
import { getUserMembership } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { DashboardOverviewEmpty } from "@/components/dashboard/empty-states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/shell/stat-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { LinkButton } from "@/components/ui/link-button";
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_BADGE,
} from "@/lib/constants";

export default async function DashboardPage() {
  const membership = await getUserMembership();
  if (!membership) return null;

  const business = membership.businesses;
  const supabase = await createClient();

  const [{ count: serviceCount }, { count: staffCount }, { data: upcoming }] =
    await Promise.all([
      supabase
        .from("services")
        .select("*", { count: "exact", head: true })
        .eq("business_id", business.id),
      supabase
        .from("business_members")
        .select("*", { count: "exact", head: true })
        .eq("business_id", business.id)
        .eq("is_bookable", true),
      supabase
        .from("appointments")
        .select("*, clients(full_name), services(name), business_members(display_name)")
        .eq("business_id", business.id)
        .gte("start_at", new Date().toISOString())
        .neq("status", "cancelled")
        .order("start_at", { ascending: true })
        .limit(5),
    ]);

  const isEmpty = (serviceCount ?? 0) === 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Overview"
        description={`Welcome back to ${business.name}`}
      />

      {isEmpty ? (
        <DashboardOverviewEmpty slug={business.slug} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard title="Services" tone="coral" icon={Scissors} value={serviceCount} />
            <StatCard title="Bookable staff" tone="teal" icon={Users} value={staffCount} />
            <StatCard title="Booking link" tone="violet" icon={ExternalLink}>
              <LinkButton variant="outline" size="sm" href={`/book/${business.slug}`} target="_blank">
                Open page
              </LinkButton>
            </StatCard>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Upcoming appointments</CardTitle>
              <LinkButton variant="ghost" size="sm" href="/dashboard/calendar">
                View calendar
              </LinkButton>
            </CardHeader>
            <CardContent>
              {!upcoming?.length ? (
                <p className="text-sm text-muted-foreground">
                  No upcoming appointments. Share your booking link to get started.
                </p>
              ) : (
                <ul className="space-y-3">
                  {upcoming.map((apt) => {
                    const client = apt.clients as unknown as { full_name: string } | null;
                    const service = apt.services as unknown as { name: string } | null;
                    const staffMember = apt.business_members as unknown as {
                      display_name: string;
                    } | null;
                    return (
                    <li
                      key={apt.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 p-3 transition-colors hover:border-primary/30 hover:bg-muted/40"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                          <CalendarClock className="h-5 w-5" />
                        </span>
                        <div>
                          <p className="font-semibold">{client?.full_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {service?.name} with {staffMember?.display_name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {format(parseISO(apt.start_at), "EEE, MMM d · h:mm a")}
                          </p>
                        </div>
                      </div>
                      <Badge variant={APPOINTMENT_STATUS_BADGE[apt.status] ?? "secondary"}>
                        {APPOINTMENT_STATUS_LABELS[apt.status]}
                      </Badge>
                    </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
