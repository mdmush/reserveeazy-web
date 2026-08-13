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

export interface InstructorHoursRow {
  staffMemberId: string;
  displayName: string;
  sessions: number;
  minutes: number;
}

export function formatHours(minutes: number): string {
  return (minutes / 60).toFixed(1);
}

export function InstructorHours({
  rows,
  month,
}: {
  rows: InstructorHoursRow[];
  month: string;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Hours taught per instructor</CardTitle>
        <ExportCsvButton
          filename={`instructor-hours-${month}.csv`}
          headers={["Instructor", "Sessions", "Hours"]}
          rows={rows.map((r) => [r.displayName, r.sessions, formatHours(r.minutes)])}
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
                <TableHead>Instructor</TableHead>
                <TableHead className="text-right">Sessions</TableHead>
                <TableHead className="text-right">Hours</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.staffMemberId}>
                  <TableCell className="font-medium">{row.displayName}</TableCell>
                  <TableCell className="text-right">{row.sessions}</TableCell>
                  <TableCell className="text-right">{formatHours(row.minutes)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
