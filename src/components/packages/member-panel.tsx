"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Receipt, SlidersHorizontal, TicketPlus } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { toast } from "sonner";
import {
  adjustCreditsSchema,
  type AdjustCreditsInput,
} from "@/lib/validations";
import {
  adjustCreditsAction,
  grantGracePassAction,
  revokeGracePassAction,
} from "@/actions/engine";
import {
  recordWaiverAcceptanceAction,
  setGuardianAction,
} from "@/actions/waivers";
import { formatPrice } from "@/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/payments";
import type {
  CreditTransaction,
  CreditTransactionKind,
  GracePass,
  Package,
  PackageInstance,
  Payment,
} from "@/types/database";
import { AssignPackageDialog } from "@/components/packages/packages-manager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type InstanceWithMeta = PackageInstance & {
  packages: { name: string } | null;
  balance: number;
  classTypeName: string | null;
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

function AdjustCreditsDialog({
  instance,
  open,
  onOpenChange,
}: {
  instance: InstanceWithMeta | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const form = useForm<AdjustCreditsInput>({
    resolver: zodResolver(adjustCreditsSchema),
    values: {
      packageInstanceId: instance?.id ?? "",
      amount: 1,
      reason: "",
    },
  });

  async function onSubmit(values: AdjustCreditsInput) {
    const result = await adjustCreditsAction(values);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Credits adjusted");
    onOpenChange(false);
    form.reset();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Adjust credits — {instance?.packages?.name ?? "package"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Credits (+/-)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>
                    Positive adds credits, negative removes them
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason (required, goes to the ledger)</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="w-full"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              )}
              Record adjustment
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export type MissedBookingOption = {
  id: string;
  label: string;
};

const PASS_STATUS_BADGE: Record<GracePass["status"], "success" | "secondary" | "outline"> = {
  available: "success",
  redeemed: "secondary",
  revoked: "outline",
};

export type WaiverStatus = {
  currentVersion: number | null;
  accepted: boolean;
  acceptedAt: string | null;
};

export type FamilyInfo = {
  guardianClientId: string | null;
  guardianName: string | null;
  dependents: { id: string; full_name: string }[];
  guardianOptions: { id: string; full_name: string }[];
};

export function MemberPanel({
  clientId,
  clientName,
  instances,
  transactions,
  payments,
  packages,
  passes,
  missedBookings,
  waiverStatus,
  family,
  showCredits,
  timezone,
}: {
  clientId: string;
  clientName: string;
  instances: InstanceWithMeta[];
  transactions: CreditTransaction[];
  payments: Payment[];
  packages: Package[];
  passes: GracePass[];
  missedBookings: MissedBookingOption[];
  waiverStatus: WaiverStatus;
  family: FamilyInfo;
  showCredits: boolean;
  timezone: string;
}) {
  const router = useRouter();
  const [adjusting, setAdjusting] = useState<InstanceWithMeta | null>(null);
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantReason, setGrantReason] = useState("");
  const [grantSource, setGrantSource] = useState<string>("");
  const [granting, setGranting] = useState(false);
  const [signatureName, setSignatureName] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [guardianDraft, setGuardianDraft] = useState(
    family.guardianClientId ?? ""
  );
  const [savingGuardian, setSavingGuardian] = useState(false);

  async function handleGrant() {
    setGranting(true);
    const result = await grantGracePassAction({
      clientId,
      reason: grantReason,
      sourceBookingId: grantSource || undefined,
    });
    setGranting(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Make-up pass granted");
    setGrantOpen(false);
    setGrantReason("");
    setGrantSource("");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Membership</CardTitle>
        <AssignPackageDialog
          packages={packages}
          clients={[]}
          presetClientId={clientId}
          trigger={
            <Button variant="outline" size="sm">
              <Receipt className="h-4 w-4 mr-1.5" aria-hidden />
              Sell package
            </Button>
          }
        />
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={showCredits ? "balances" : "waiver"}>
          <TabsList>
            {showCredits && (
              <>
                <TabsTrigger value="balances">Balances</TabsTrigger>
                <TabsTrigger value="ledger">Ledger</TabsTrigger>
                <TabsTrigger value="passes">Passes</TabsTrigger>
                <TabsTrigger value="payments">Payments</TabsTrigger>
              </>
            )}
            <TabsTrigger value="waiver">Waiver</TabsTrigger>
            <TabsTrigger value="family">Family</TabsTrigger>
          </TabsList>

          <TabsContent value="balances" className="pt-4">
            {!instances.length ? (
              <p className="text-sm text-muted-foreground">
                No packages yet — sell one to grant credits.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Package</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead className="text-right">Credits left</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {instances.map((instance) => (
                    <TableRow key={instance.id}>
                      <TableCell className="font-medium">
                        {instance.packages?.name ?? "Package"}
                      </TableCell>
                      <TableCell>
                        {instance.scope === "locked" ? (
                          <Badge variant="secondary">
                            {instance.classTypeName ?? "Locked"}
                          </Badge>
                        ) : (
                          <Badge variant="success">Flexible</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {instance.balance}
                        <span className="text-muted-foreground font-normal">
                          {" "}
                          / {instance.credit_count}
                        </span>
                      </TableCell>
                      <TableCell>
                        {instance.expires_at ? (
                          <span
                            className={
                              new Date(instance.expires_at) < new Date()
                                ? "text-destructive"
                                : undefined
                            }
                          >
                            {formatInTimeZone(
                              instance.expires_at,
                              timezone,
                              "d MMM yyyy"
                            )}
                          </span>
                        ) : (
                          <Badge variant="outline">
                            Starts on first attendance
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Adjust credits"
                          onClick={() => setAdjusting(instance)}
                        >
                          <SlidersHorizontal className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="ledger" className="pt-4">
            {!transactions.length ? (
              <p className="text-sm text-muted-foreground">
                Every credit movement will appear here.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead className="text-right">Credits</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatInTimeZone(
                          tx.created_at,
                          timezone,
                          "d MMM, h:mm a"
                        )}
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
                      <TableCell className="text-sm text-muted-foreground">
                        {tx.reason ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="passes" className="pt-4 space-y-4">
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setGrantOpen(true)}
              >
                <TicketPlus className="h-4 w-4 mr-1.5" aria-hidden />
                Grant make-up pass
              </Button>
            </div>
            {!passes.length ? (
              <p className="text-sm text-muted-foreground">
                No passes. Grant one when a member misses a class with a valid
                reason — it lets them attend a different class type as a
                make-up.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Granted</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {passes.map((pass) => (
                    <TableRow key={pass.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatInTimeZone(pass.created_at, timezone, "d MMM yyyy")}
                      </TableCell>
                      <TableCell className="text-sm">{pass.reason}</TableCell>
                      <TableCell>
                        <Badge variant={PASS_STATUS_BADGE[pass.status]}>
                          {pass.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {pass.status === "available" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              const reason = window.prompt(
                                "Reason for revoking this pass?"
                              );
                              if (!reason?.trim()) return;
                              const result = await revokeGracePassAction({
                                passId: pass.id,
                                clientId,
                                reason,
                              });
                              if (result.error) {
                                toast.error(result.error);
                                return;
                              }
                              toast.success("Pass revoked");
                              router.refresh();
                            }}
                          >
                            Revoke
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="payments" className="pt-4">
            {!payments.length ? (
              <p className="text-sm text-muted-foreground">No payments yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Receipt</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
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
                      <TableCell>
                        {PAYMENT_METHOD_LABELS[payment.method]}
                      </TableCell>
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
          <TabsContent value="waiver" className="pt-4 space-y-4">
            {waiverStatus.currentVersion === null ? (
              <p className="text-sm text-muted-foreground">
                No waiver has been published yet — bookings are not gated.
              </p>
            ) : waiverStatus.accepted ? (
              <div className="flex items-center gap-2">
                <Badge variant="success">
                  Accepted v{waiverStatus.currentVersion}
                </Badge>
                {waiverStatus.acceptedAt && (
                  <span className="text-sm text-muted-foreground">
                    on{" "}
                    {formatInTimeZone(
                      waiverStatus.acceptedAt,
                      timezone,
                      "d MMM yyyy, h:mm a"
                    )}
                  </span>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <Badge variant="outline">
                  Waiver v{waiverStatus.currentVersion} not accepted — bookings
                  are blocked
                </Badge>
                <div className="space-y-2">
                  <Label htmlFor="signature-name">
                    {family.guardianClientId
                      ? `Guardian signs on the studio device (${family.guardianName ?? "guardian"})`
                      : "Member signs on the studio device — type the name as signed"}
                  </Label>
                  <Input
                    id="signature-name"
                    value={signatureName}
                    onChange={(e) => setSignatureName(e.target.value)}
                    placeholder={
                      family.guardianClientId
                        ? (family.guardianName ?? "Guardian name")
                        : clientName
                    }
                  />
                </div>
                <Button
                  disabled={!signatureName.trim() || accepting}
                  onClick={async () => {
                    setAccepting(true);
                    const result = await recordWaiverAcceptanceAction({
                      clientId,
                      signatureName,
                      acceptedByClientId: family.guardianClientId ?? undefined,
                    });
                    setAccepting(false);
                    if (result.error) {
                      toast.error(result.error);
                      return;
                    }
                    toast.success("Waiver acceptance recorded");
                    setSignatureName("");
                    router.refresh();
                  }}
                >
                  {accepting && (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  )}
                  Record acceptance
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="family" className="pt-4 space-y-4">
            <div className="space-y-2">
              <Label>Guardian</Label>
              <div className="flex gap-2">
                <select
                  className="flex-1 rounded-md border bg-background p-2 text-sm"
                  value={guardianDraft}
                  onChange={(e) => setGuardianDraft(e.target.value)}
                >
                  <option value="">No guardian (books independently)</option>
                  {family.guardianOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.full_name}
                    </option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  disabled={
                    guardianDraft === (family.guardianClientId ?? "") ||
                    savingGuardian
                  }
                  onClick={async () => {
                    setSavingGuardian(true);
                    const result = await setGuardianAction({
                      clientId,
                      guardianClientId: guardianDraft || null,
                    });
                    setSavingGuardian(false);
                    if (result.error) {
                      toast.error(result.error);
                      return;
                    }
                    toast.success("Family link updated");
                    router.refresh();
                  }}
                >
                  {savingGuardian ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                A guardian books and signs waivers for this member. Credits are
                never shared between family members.
              </p>
            </div>
            {family.dependents.length > 0 && (
              <div className="space-y-2">
                <Label>Dependents of this member</Label>
                <ul className="space-y-1">
                  {family.dependents.map((dependent) => (
                    <li key={dependent.id}>
                      <Link
                        href={`/dashboard/clients/${dependent.id}`}
                        className="text-sm text-primary hover:underline"
                      >
                        {dependent.full_name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      <AdjustCreditsDialog
        instance={adjusting}
        open={!!adjusting}
        onOpenChange={(open) => {
          if (!open) setAdjusting(null);
        }}
      />

      <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant a make-up pass</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              A pass lets the member attend a class of a different type as a
              make-up for a missed class. It consumes the originally missed
              credit — no new credits are created.
            </p>
            {missedBookings.length > 0 && (
              <div className="space-y-2">
                <Label>Missed class (optional)</Label>
                <select
                  className="w-full rounded-md border bg-background p-2 text-sm"
                  value={grantSource}
                  onChange={(e) => setGrantSource(e.target.value)}
                >
                  <option value="">Not linked to a specific class</option>
                  {missedBookings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="pass-reason">Reason (required, logged)</Label>
              <Textarea
                id="pass-reason"
                value={grantReason}
                onChange={(e) => setGrantReason(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              disabled={!grantReason.trim() || granting}
              onClick={handleGrant}
            >
              {granting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Grant pass
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
