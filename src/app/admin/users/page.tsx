import { format, parseISO } from "date-fns";
import { fetchAdminUsers } from "@/actions/admin";
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

export default async function AdminUsersPage() {
  const users = await fetchAdminUsers();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description={`${users.length} registered user${users.length === 1 ? "" : "s"}`}
      />

      <Card className="border-border/60 shadow-sm">
        <CardContent className="p-0">
          {users.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No users yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Businesses</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {u.full_name || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.email ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      {u.businesses.length > 0 ? u.businesses.join(", ") : "—"}
                    </TableCell>
                    <TableCell>
                      {u.is_superuser ? (
                        <Badge variant="secondary">Superuser</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">User</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(parseISO(u.created_at), "MMM d, yyyy")}
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
