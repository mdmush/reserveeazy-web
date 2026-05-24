import Link from "next/link";
import { format, parseISO } from "date-fns";
import { fetchAdminBusinesses } from "@/actions/admin";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";

export default async function AdminBusinessesPage() {
  const businesses = await fetchAdminBusinesses();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Businesses"
        description={`${businesses.length} tenant${businesses.length === 1 ? "" : "s"} on the platform`}
      />

      <Card className="border-border/60 shadow-sm">
        <CardContent className="p-0">
          {businesses.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No businesses yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Members</TableHead>
                  <TableHead className="text-right">Services</TableHead>
                  <TableHead className="text-right">Appointments</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {businesses.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <Link
                        href={`/admin/businesses/${b.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {b.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{b.slug}</TableCell>
                    <TableCell className="capitalize">{b.business_type.replace("_", " ")}</TableCell>
                    <TableCell className="text-right">{b.memberCount}</TableCell>
                    <TableCell className="text-right">{b.serviceCount}</TableCell>
                    <TableCell className="text-right">{b.appointmentCount}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(parseISO(b.created_at), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
