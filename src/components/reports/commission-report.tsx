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
import { formatPrice } from "@/lib/format";
import { formatHours } from "@/components/reports/instructor-hours";

export interface CommissionRow {
  teacherId: string;
  displayName: string;
  classesTaught: number;
  attendedHeadcount: number;
  minutesTaught: number;
  commissionCents: number;
}

export function CommissionReport({
  rows,
  month,
}: {
  rows: CommissionRow[];
  month: string;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Instructor commission</CardTitle>
        <ExportCsvButton
          filename={`commission-${month}.csv`}
          headers={["Instructor", "Classes", "Attended", "Hours", "Commission (RM)"]}
          rows={rows.map((r) => [
            r.displayName,
            r.classesTaught,
            r.attendedHeadcount,
            formatHours(r.minutesTaught),
            (r.commissionCents / 100).toFixed(2),
          ])}
        />
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No attended classes this month.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Instructor</TableHead>
                <TableHead className="text-right">Classes</TableHead>
                <TableHead className="text-right">Attended</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead className="text-right">Commission</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.teacherId}>
                  <TableCell className="font-medium">{row.displayName}</TableCell>
                  <TableCell className="text-right">{row.classesTaught}</TableCell>
                  <TableCell className="text-right">{row.attendedHeadcount}</TableCell>
                  <TableCell className="text-right">
                    {formatHours(row.minutesTaught)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatPrice(row.commissionCents, "MYR")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
