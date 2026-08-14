import { notFound } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { getUserMembership } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/payments";
import type { Payment } from "@/types/database";
import { LinkButton } from "@/components/ui/link-button";
import { PrintButton } from "@/components/packages/print-button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type PaymentDetail = Payment & {
  clients: { full_name: string; email: string | null } | null;
  package_instances: {
    packages: { name: string; credit_count: number } | null;
  } | null;
};

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const membership = await getUserMembership();
  if (!membership) return null;

  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select(
      "*, clients(full_name, email), package_instances(packages(name, credit_count))"
    )
    .eq("id", id)
    .eq("business_id", membership.business_id)
    .maybeSingle();

  if (!data) notFound();
  const payment = data as unknown as PaymentDetail;
  const business = membership.businesses;
  const packageInfo = payment.package_instances?.packages;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <LinkButton variant="ghost" size="sm" href="/dashboard/receipts">
          <ArrowLeft className="h-4 w-4 mr-1.5" aria-hidden />
          Receipts
        </LinkButton>
        <PrintButton>
          <Printer className="h-4 w-4 mr-2" aria-hidden />
          Print
        </PrintButton>
      </div>

      <Card className="mx-auto max-w-lg print:border-0 print:shadow-none">
        <CardContent className="space-y-6 p-8">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xl font-bold">{business.name}</p>
              <p className="text-sm text-muted-foreground">Official receipt</p>
            </div>
            <div className="text-right">
              <p className="font-mono font-semibold">{payment.receipt_number}</p>
              <p className="text-sm text-muted-foreground">
                {formatInTimeZone(
                  payment.paid_at,
                  business.timezone,
                  "d MMM yyyy, h:mm a"
                )}
              </p>
            </div>
          </div>

          <Separator />

          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Received from</dt>
              <dd className="font-medium">{payment.clients?.full_name ?? "—"}</dd>
            </div>
            {packageInfo && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">For</dt>
                <dd className="font-medium">
                  {packageInfo.name} ({packageInfo.credit_count} credits)
                </dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Payment method</dt>
              <dd className="font-medium">
                {PAYMENT_METHOD_LABELS[payment.method]}
              </dd>
            </div>
            {payment.notes && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Notes</dt>
                <dd className="font-medium">{payment.notes}</dd>
              </div>
            )}
          </dl>

          <Separator />

          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Amount paid
            </p>
            <p className="text-2xl font-bold">
              {formatPrice(payment.amount_cents, "MYR")}
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            Recorded digitally by {business.name} via CUSP. This receipt confirms
            payment received; it is not a tax invoice.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
