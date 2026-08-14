import Link from "next/link";
import { Receipt } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { getUserMembership } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/payments";
import type { Payment } from "@/types/database";
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

type PaymentWithClient = Payment & {
  clients: { full_name: string } | null;
};

export default async function ReceiptsPage() {
  const membership = await getUserMembership();
  if (!membership) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("*, clients(full_name)")
    .eq("business_id", membership.business_id)
    .order("receipt_no", { ascending: false })
    .limit(200);

  const payments = (data ?? []) as unknown as PaymentWithClient[];
  const timezone = membership.businesses.timezone;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Receipts"
        description="Digital receipts for recorded payments"
      />

      {!payments.length ? (
        <EmptyState
          icon={<Receipt className="h-10 w-10" />}
          title="No receipts yet"
          description="Receipts are issued automatically when you sell a package or settle a payment due."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Receipt</TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/receipts/${payment.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {payment.receipt_number}
                    </Link>
                  </TableCell>
                  <TableCell>{payment.clients?.full_name ?? "—"}</TableCell>
                  <TableCell>{PAYMENT_METHOD_LABELS[payment.method]}</TableCell>
                  <TableCell>{formatPrice(payment.amount_cents, "MYR")}</TableCell>
                  <TableCell>
                    {formatInTimeZone(payment.paid_at, timezone, "d MMM yyyy")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
