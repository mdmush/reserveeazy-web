import Link from "next/link";
import { AlertTriangle, CalendarDays, Ticket, Users } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { requireMemberClient, getActingClients } from "@/lib/member";
import { createClient } from "@/lib/supabase/server";
import { nowMs } from "@/lib/clock";
import type { PackageInstance } from "@/types/database";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/link-button";
import { Alert, AlertDescription } from "@/components/ui/alert";

type UpcomingBooking = {
  booking_id: string;
  client_name: string;
  status: string;
  type_name: string;
  start_at: string;
  teacher_name: string;
};

export default async function PortalHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const context = await requireMemberClient(slug);
  const { business, capabilities } = context;
  const acting = getActingClients(context);
  const actingIds = acting.map((c) => c.id);
  const supabase = await createClient();

  const [
    { data: currentWaiver },
    { data: instances },
    { data: balances },
    { data: bookingsJson },
  ] = await Promise.all([
    supabase
      .from("waiver_versions")
      .select("id, version")
      .eq("business_id", business.id)
      .not("published_at", "is", null)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    capabilities.credits
      ? supabase.from("package_instances").select("*").in("client_id", actingIds)
      : Promise.resolve({ data: [] as PackageInstance[] }),
    capabilities.credits
      ? supabase
          .from("package_instance_balances")
          .select("*")
          .in("client_id", actingIds)
      : Promise.resolve({ data: [] as { package_instance_id: string; balance: number }[] }),
    supabase.rpc("get_member_bookings", { p_business_id: business.id }),
  ]);

  // Waiver banner: anyone in the family missing the current version?
  let unsigned: string[] = [];
  if (currentWaiver) {
    const { data: acceptances } = await supabase
      .from("waiver_acceptances")
      .select("client_id")
      .eq("waiver_version_id", currentWaiver.id)
      .in("client_id", actingIds);
    const signedIds = new Set((acceptances ?? []).map((a) => a.client_id));
    unsigned = acting
      .filter((c) => !signedIds.has(c.id))
      .map((c) => (c.id === context.client.id ? "you" : c.full_name));
  }

  const balanceByInstance = new Map(
    (balances ?? []).map((b) => [b.package_instance_id, b.balance])
  );
  const totalCredits = ((instances ?? []) as PackageInstance[]).reduce(
    (sum, instance) => sum + (balanceByInstance.get(instance.id) ?? 0),
    0
  );
  const soonestExpiry = ((instances ?? []) as PackageInstance[])
    .map((i) => i.expires_at)
    .filter((d): d is string => !!d)
    .sort()[0];

  const now = nowMs();
  const upcoming = ((bookingsJson ?? []) as unknown as UpcomingBooking[])
    .filter(
      (b) =>
        new Date(b.start_at).getTime() > now &&
        ["booked", "pass_makeup", "waitlisted", "offered"].includes(b.status)
    )
    .sort((a, b) => a.start_at.localeCompare(b.start_at))
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hi, ${context.client.full_name.split(" ")[0]}!`}
        description={business.name}
      />

      {unsigned.length > 0 && (
        <Alert variant="destructive" role="alert">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          <AlertDescription>
            The studio waiver needs signing for {unsigned.join(", ")} before
            booking.{" "}
            <Link
              href={`/portal/${slug}/waiver`}
              className="font-medium underline underline-offset-4"
            >
              Read &amp; sign it here
            </Link>
            .
          </AlertDescription>
        </Alert>
      )}

      {capabilities.credits && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold">Credits left</CardTitle>
              <Ticket className="h-4 w-4 text-muted-foreground" aria-hidden />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{totalCredits}</p>
              {soonestExpiry && (
                <p className="text-xs text-muted-foreground">
                  Next expiry:{" "}
                  {formatInTimeZone(soonestExpiry, business.timezone, "d MMM yyyy")}
                </p>
              )}
              <LinkButton
                variant="ghost"
                size="sm"
                className="mt-2 -ml-2"
                href={`/portal/${slug}/membership`}
              >
                View packages
              </LinkButton>
            </CardContent>
          </Card>
          {acting.length > 1 && (
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold">Family</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" aria-hidden />
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {context.dependents.map((dependent) => (
                  <Badge key={dependent.id} variant="secondary">
                    {dependent.full_name}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" aria-hidden />
            Coming up
          </CardTitle>
          <LinkButton variant="ghost" size="sm" href={`/portal/${slug}/schedule`}>
            Browse schedule
          </LinkButton>
        </CardHeader>
        <CardContent>
          {!upcoming.length ? (
            <p className="text-sm text-muted-foreground">
              Nothing booked yet — pick a class from the schedule.
            </p>
          ) : (
            <ul className="divide-y">
              {upcoming.map((booking) => (
                <li key={booking.booking_id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">{booking.type_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatInTimeZone(
                        booking.start_at,
                        business.timezone,
                        "EEE d MMM, h:mm a"
                      )}
                      {" · "}
                      {booking.teacher_name}
                      {acting.length > 1 ? ` · ${booking.client_name}` : ""}
                    </p>
                  </div>
                  <Badge
                    variant={
                      booking.status === "waitlisted"
                        ? "outline"
                        : booking.status === "offered"
                          ? "secondary"
                          : "success"
                    }
                  >
                    {booking.status === "pass_makeup"
                      ? "Booked (pass)"
                      : booking.status === "waitlisted"
                        ? "Waitlisted"
                        : booking.status === "offered"
                          ? "Spot offered!"
                          : "Booked"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
