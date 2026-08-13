import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExportCsvButton } from "@/components/reports/export-csv-button";

export interface MemberSessionsRow {
  clientId: string;
  fullName: string;
  sessions: number;
}

export function MemberSessions({
  rows,
  month,
}: {
  rows: MemberSessionsRow[];
  month: string;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Sessions per member</CardTitle>
        <ExportCsvButton
          filename={`member-sessions-${month}.csv`}
          headers={["Member", "Sessions"]}
          rows={rows.map((r) => [r.fullName, r.sessions])}
        />
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No confirmed or completed sessions this month.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead className="text-right">Sessions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.clientId}>
                  <TableCell className="font-medium">{row.fullName}</TableCell>
                  <TableCell className="text-right">{row.sessions}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
