import Link from "next/link";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { CalendarClock, Scissors } from "lucide-react";
import { fetchAdminBusinessDetail } from "@/actions/admin";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/constants";
import { formatPrice, formatDuration } from "@/lib/format";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-states";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LinkButton } from "@/components/ui/link-button";

export default async function AdminBusinessDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await fetchAdminBusinessDetail(id);
  if (!detail) notFound();

  const { business, members, services, appointments } = detail;

  return (
    <div className="space-y-6">
      <PageHeader
        title={business.name}
        description={`/book/${business.slug} · ${business.timezone}`}
        action={
          <LinkButton variant="outline" href={`/book/${business.slug}`} target="_blank">
            View booking page
          </LinkButton>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium capitalize">{business.business_type.replace("_", " ")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Auto-confirm
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">
              {business.settings.auto_confirm ? "Yes" : "No"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Created
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">
              {format(parseISO(business.created_at), "MMM d, yyyy")}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Members</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Bookable</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.display_name}</TableCell>
                  <TableCell className="text-muted-foreground">{m.email ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{m.role}</Badge>
                  </TableCell>
                  <TableCell>{m.is_bookable ? "Yes" : "No"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Services</CardTitle>
        </CardHeader>
        <CardContent className={services.length === 0 ? undefined : "p-0"}>
          {services.length === 0 ? (
            <EmptyState
              icon={<Scissors className="h-10 w-10" />}
              title="No services yet"
              description="This business hasn't added any services."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{formatDuration(s.duration_minutes)}</TableCell>
                    <TableCell>{formatPrice(s.price_cents)}</TableCell>
                    <TableCell>{s.is_active ? "Yes" : "No"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent appointments</CardTitle>
        </CardHeader>
        <CardContent className={appointments.length === 0 ? undefined : "p-0"}>
          {appointments.length === 0 ? (
            <EmptyState
              icon={<CalendarClock className="h-10 w-10" />}
              title="No appointments yet"
              description="Appointments for this business will show up here."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appointments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      {format(parseISO(a.start_at), "EEE, MMM d · h:mm a")}
                    </TableCell>
                    <TableCell>{a.clientName ?? "—"}</TableCell>
                    <TableCell>{a.serviceName ?? "—"}</TableCell>
                    <TableCell>{a.staffName ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {APPOINTMENT_STATUS_LABELS[a.status]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Link
        href="/admin/businesses"
        className="text-sm text-primary hover:underline inline-block"
      >
        ← All businesses
      </Link>
    </div>
  );
}
