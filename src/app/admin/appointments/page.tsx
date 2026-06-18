import { format, parseISO } from "date-fns";
import { fetchAdminAppointments } from "@/actions/admin";
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_BADGE } from "@/lib/constants";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LinkButton } from "@/components/ui/link-button";

export default async function AdminAppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const { appointments, total, pageSize } = await fetchAdminAppointments(page);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointments"
        description={`${total} appointment${total === 1 ? "" : "s"} across all businesses`}
      />

      <Card className="border-border/60 shadow-sm">
        <CardContent className="p-0">
          {appointments.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No appointments yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appointments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      {format(parseISO(a.start_at), "EEE, MMM d · h:mm a")}
                    </TableCell>
                    <TableCell>
                      {a.business ? (
                        <span className="font-medium">{a.business.name}</span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>{a.clientName ?? "—"}</TableCell>
                    <TableCell>{a.serviceName ?? "—"}</TableCell>
                    <TableCell>{a.staffName ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={APPOINTMENT_STATUS_BADGE[a.status] ?? "secondary"}>
                        {APPOINTMENT_STATUS_LABELS[a.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground">
                      {a.source?.replace("_", " ") ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <LinkButton variant="outline" size="sm" href={`/admin/appointments?page=${page - 1}`}>
                Previous
              </LinkButton>
            )}
            {page < totalPages && (
              <LinkButton variant="outline" size="sm" href={`/admin/appointments?page=${page + 1}`}>
                Next
              </LinkButton>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
