import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Building2, Users, CalendarClock, CalendarCheck } from "lucide-react";
import { fetchAdminOverviewStats } from "@/actions/admin";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/shell/stat-card";

export default async function AdminOverviewPage() {
  const stats = await fetchAdminOverviewStats();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform overview"
        description="Cross-tenant visibility for ReserveEazy operators"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Businesses" tone="blue" icon={Building2} value={stats.businessCount} />
        <StatCard title="Users" tone="violet" icon={Users} value={stats.userCount} />
        <StatCard title="Appointments (7d)" tone="teal" icon={CalendarClock} value={stats.appointmentWeek} />
        <StatCard title="Appointments (total)" tone="primary" icon={CalendarCheck} value={stats.appointmentTotal} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent businesses</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentBusinesses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No businesses yet.</p>
            ) : (
              <ul className="space-y-3">
                {stats.recentBusinesses.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-2">
                    <div>
                      <Link
                        href={`/admin/businesses/${b.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {b.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">/book/{b.slug}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {format(parseISO(b.created_at), "MMM d, yyyy")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent signups</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentProfiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No users yet.</p>
            ) : (
              <ul className="space-y-3">
                {stats.recentProfiles.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{p.full_name || "Unnamed"}</p>
                      <p className="text-xs text-muted-foreground">{p.email}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {p.is_superuser && (
                        <Badge variant="secondary" className="mb-1">
                          Superuser
                        </Badge>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(p.created_at), "MMM d, yyyy")}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
