"use client";

import { formatInTimeZone } from "date-fns-tz";
import { formatPrice } from "@/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/payments";
import type {
  CreditTransaction,
  CreditTransactionKind,
  GracePass,
  PackageInstance,
  Payment,
} from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type MemberInstanceRow = PackageInstance & {
  balance: number;
  packageName: string;
  classTypeName: string | null;
  clientName: string;
};

const KIND_LABELS: Record<CreditTransactionKind, string> = {
  purchase_grant: "Purchase",
  deduction: "Booking",
  refund: "Refund",
  forfeit: "Forfeit",
  pass_grant: "Pass granted",
  pass_redemption: "Pass used",
  manual_adjustment: "Adjustment",
};

const PASS_STATUS_BADGE: Record<GracePass["status"], "success" | "secondary" | "outline"> = {
  available: "success",
  redeemed: "secondary",
  revoked: "outline",
};

export function MembershipView({
  instances,
  transactions,
  passes,
  payments,
  showClientNames,
  timezone,
}: {
  instances: MemberInstanceRow[];
  transactions: CreditTransaction[];
  passes: GracePass[];
  payments: Payment[];
  showClientNames: boolean;
  timezone: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <Tabs defaultValue="packages">
          <TabsList>
            <TabsTrigger value="packages">Packages</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="passes">Passes</TabsTrigger>
            <TabsTrigger value="receipts">Receipts</TabsTrigger>
          </TabsList>

          <TabsContent value="packages" className="pt-4">
            {!instances.length ? (
              <p className="text-sm text-muted-foreground">
                No packages yet — visit the front desk to get started.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Package</TableHead>
                    {showClientNames && <TableHead>Member</TableHead>}
                    <TableHead className="text-right">Credits left</TableHead>
                    <TableHead>Valid until</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {instances.map((instance) => (
                    <TableRow key={instance.id}>
                      <TableCell>
                        <p className="font-medium">{instance.packageName}</p>
                        {instance.scope === "locked" ? (
                          <Badge variant="secondary">
                            {instance.classTypeName ?? "One class type"}
                          </Badge>
                        ) : (
                          <Badge variant="success">Any class</Badge>
                        )}
                      </TableCell>
                      {showClientNames && (
                        <TableCell>{instance.clientName}</TableCell>
                      )}
                      <TableCell className="text-right font-semibold">
                        {instance.balance}
                        <span className="font-normal text-muted-foreground">
                          {" "}
                          / {instance.credit_count}
                        </span>
                      </TableCell>
                      <TableCell>
                        {instance.expires_at ? (
                          formatInTimeZone(instance.expires_at, timezone, "d MMM yyyy")
                        ) : (
                          <Badge variant="outline">Starts at first class</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="history" className="pt-4">
            {!transactions.length ? (
              <p className="text-sm text-muted-foreground">
                Your credit activity will appear here.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>What</TableHead>
                    <TableHead className="text-right">Credits</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatInTimeZone(tx.created_at, timezone, "d MMM, h:mm a")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{KIND_LABELS[tx.kind]}</Badge>
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${
                          tx.amount > 0
                            ? "text-teal-foreground"
                            : tx.amount < 0
                              ? "text-destructive"
                              : "text-muted-foreground"
                        }`}
                      >
                        {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="passes" className="pt-4">
            {!passes.length ? (
              <p className="text-sm text-muted-foreground">
                Make-up passes granted by the studio will appear here.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Granted</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {passes.map((pass) => (
                    <TableRow key={pass.id}>
                      <TableCell>
                        {formatInTimeZone(pass.created_at, timezone, "d MMM yyyy")}
                      </TableCell>
                      <TableCell>
                        <Badge variant={PASS_STATUS_BADGE[pass.status]}>
                          {pass.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="receipts" className="pt-4">
            {!payments.length ? (
              <p className="text-sm text-muted-foreground">No payments yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Receipt</TableHead>
                    <TableHead>Paid via</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-mono">
                        {payment.receipt_number}
                      </TableCell>
                      <TableCell>{PAYMENT_METHOD_LABELS[payment.method]}</TableCell>
                      <TableCell className="text-right">
                        {formatPrice(payment.amount_cents, "MYR")}
                      </TableCell>
                      <TableCell>
                        {formatInTimeZone(payment.paid_at, timezone, "d MMM yyyy")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
