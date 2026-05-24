import Link from "next/link";
import { format, parseISO } from "date-fns";
import { getUserMembership } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { DashboardOverviewEmpty } from "@/components/dashboard/empty-states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/dashboard/page-header";
import { LinkButton } from "@/components/ui/link-button";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/constants";

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
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Services
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{serviceCount}</p>
              </CardContent>
            </Card>
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Bookable staff
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{staffCount}</p>
              </CardContent>
            </Card>
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Booking link
                </CardTitle>
              </CardHeader>
              <CardContent>
                <LinkButton variant="outline" size="sm" href={`/book/${business.slug}`} target="_blank">
                  Open page
                </LinkButton>
              </CardContent>
            </Card>
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
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                    >
                      <div>
                        <p className="font-medium">{client?.full_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {service?.name} with {staffMember?.display_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {format(parseISO(apt.start_at), "EEE, MMM d · h:mm a")}
                        </p>
                      </div>
                      <Badge variant="secondary">
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
