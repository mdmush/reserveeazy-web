import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Building2 } from "lucide-react";
import { fetchAdminBusinesses } from "@/actions/admin";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-states";
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

      {businesses.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-10 w-10" />}
          title="No businesses yet"
          description="Businesses created on the platform will show up here."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
