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
  /** Mode B only: unsettled attendance dues in cents. */
  outstandingDueCents?: number;
}

export function MemberSessions({
  rows,
  month,
  showDues = false,
}: {
  rows: MemberSessionsRow[];
  month: string;
  showDues?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Sessions per member</CardTitle>
        <ExportCsvButton
          filename={`member-sessions-${month}.csv`}
          headers={
            showDues ? ["Member", "Sessions", "Outstanding (RM)"] : ["Member", "Sessions"]
          }
          rows={rows.map((r) =>
            showDues
              ? [r.fullName, r.sessions, ((r.outstandingDueCents ?? 0) / 100).toFixed(2)]
              : [r.fullName, r.sessions]
          )}
        />
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No sessions this month.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead className="text-right">Sessions</TableHead>
                {showDues && (
                  <TableHead className="text-right">Outstanding</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.clientId}>
                  <TableCell className="font-medium">{row.fullName}</TableCell>
                  <TableCell className="text-right">{row.sessions}</TableCell>
                  {showDues && (
                    <TableCell className="text-right">
                      {row.outstandingDueCents
                        ? `RM ${(row.outstandingDueCents / 100).toFixed(2)}`
                        : "—"}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
