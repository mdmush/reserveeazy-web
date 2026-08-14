import Link from "next/link";
import { BellRing } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { createClient } from "@/lib/supabase/server";
import type { Business } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * The admin's "things waiting on a WhatsApp tap" card: pending waitlist
 * offers, tomorrow's classes (reminders), and packages expiring soon.
 */
export async function PendingNotifications({ business }: { business: Business }) {
  const supabase = await createClient();
  const now = new Date();
  const warningDays =
    (business.settings as { package_expiry_warning_days?: number })
      .package_expiry_warning_days ?? 7;

  const [{ data: offers }, { data: tomorrowSessions }, { data: expiring }] =
    await Promise.all([
      supabase
        .from("bookings")
        .select("id, offer_expires_at, class_session_id, clients(full_name)")
        .eq("business_id", business.id)
        .eq("status", "offered"),
      supabase
        .from("class_sessions")
        .select("id, start_at, class_types(name)")
        .eq("business_id", business.id)
        .eq("status", "scheduled")
        .gte("start_at", now.toISOString())
        .lt("start_at", new Date(now.getTime() + 36 * 3600_000).toISOString()),
      supabase
        .from("package_instances")
        .select("id, expires_at, clients(full_name), packages(name)")
        .eq("business_id", business.id)
        .gte("expires_at", now.toISOString())
        .lte(
          "expires_at",
          new Date(now.getTime() + warningDays * 24 * 3600_000).toISOString()
        ),
    ]);

  const offerRows = (offers ?? []) as unknown as {
    id: string;
    offer_expires_at: string | null;
    class_session_id: string;
    clients: { full_name: string } | null;
  }[];
  const sessionRows = (tomorrowSessions ?? []) as unknown as {
    id: string;
    start_at: string;
    class_types: { name: string } | null;
  }[];
  const expiringRows = (expiring ?? []) as unknown as {
    id: string;
    expires_at: string;
    clients: { full_name: string } | null;
    packages: { name: string } | null;
  }[];

  if (!offerRows.length && !sessionRows.length && !expiringRows.length) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="h-5 w-5" aria-hidden />
          Waiting on you
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {offerRows.map((offer) => (
          <div key={offer.id} className="flex items-center justify-between gap-3">
            <span>
              <Badge variant="success" className="mr-2">
                Waitlist offer
              </Badge>
              {offer.clients?.full_name ?? "Member"}
              {offer.offer_expires_at &&
                ` — claim by ${formatInTimeZone(offer.offer_expires_at, business.timezone, "h:mm a")}`}
            </span>
            <Link
              className="text-primary hover:underline"
              href={`/dashboard/schedule/${offer.class_session_id}`}
            >
              Open
            </Link>
          </div>
        ))}
        {sessionRows.map((session) => (
          <div key={session.id} className="flex items-center justify-between gap-3">
            <span>
              <Badge variant="secondary" className="mr-2">
                Reminders due
              </Badge>
              {session.class_types?.name ?? "Class"} ·{" "}
              {formatInTimeZone(session.start_at, business.timezone, "EEE h:mm a")}
            </span>
            <Link
              className="text-primary hover:underline"
              href={`/dashboard/schedule/${session.id}`}
            >
              Roster
            </Link>
          </div>
        ))}
        {expiringRows.map((instance) => (
          <div key={instance.id} className="flex items-center justify-between gap-3">
            <span>
              <Badge variant="outline" className="mr-2">
                Expiring
              </Badge>
              {instance.clients?.full_name ?? "Member"} —{" "}
              {instance.packages?.name ?? "package"} ends{" "}
              {formatInTimeZone(instance.expires_at, business.timezone, "d MMM")}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
