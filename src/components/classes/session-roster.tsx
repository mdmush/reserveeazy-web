"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Loader2,
  MessageCircle,
  XCircle,
  Hourglass,
  Check,
  UserX,
  Undo2,
} from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { toast } from "sonner";
import {
  bookClassAction,
  cancelBookingAction,
  markAttendanceAction,
  revertAttendanceAction,
  offerWaitlistSpotAction,
  claimWaitlistOfferAction,
  releaseWaitlistOfferAction,
} from "@/actions/engine";
import {
  classCreditCost,
  orderEligibleInstances,
  cancellationOutcome,
  type FundableInstance,
} from "@/lib/credit-engine";
import { waLink, waTemplates } from "@/lib/whatsapp";
import { nowMs } from "@/lib/clock";
import type { Booking, BookingStatus, GracePass } from "@/types/database";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type RosterBooking = Booking & {
  clients: { full_name: string; phone: string | null } | null;
};

export type RosterClient = { id: string; full_name: string };

export type RosterInstance = FundableInstance & {
  packageName: string;
};

const STATUS_LABELS: Partial<Record<BookingStatus, string>> = {
  booked: "Booked",
  pass_makeup: "Make-up pass",
  attended: "Attended",
  no_show: "No-show",
  waitlisted: "Waitlisted",
  offered: "Offered",
};

export function SessionRoster({
  sessionId,
  sessionInfo,
  capacity,
  classTypeId,
  classTypeCreditCost,
  cutoffHours,
  bookings,
  clients,
  instances,
  passes = [],
  timezone,
  mode = "admin",
}: {
  sessionId: string;
  sessionInfo: { className: string; startAt: string; studioName: string };
  capacity: number;
  classTypeId: string;
  classTypeCreditCost: number;
  cutoffHours: number;
  bookings: RosterBooking[];
  clients: RosterClient[];
  instances: RosterInstance[];
  passes?: GracePass[];
  timezone: string;
  mode?: "admin" | "teacher";
}) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState<RosterBooking | null>(null);
  const [bookOpen, setBookOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [booking, setBooking] = useState(false);
  const [usePass, setUsePass] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [reverting, setReverting] = useState<RosterBooking | null>(null);
  const [revertReason, setRevertReason] = useState("");

  const isAdmin = mode === "admin";
  // Mirrors the RPC guard: attendance opens 15 minutes before start.
  const attendanceOpen =
    new Date(sessionInfo.startAt).getTime() <= nowMs() + 15 * 60_000;

  async function handleMark(row: RosterBooking, present: boolean) {
    setMarkingId(row.id);
    const result = await markAttendanceAction({
      bookingId: row.id,
      classSessionId: sessionId,
      present,
    });
    setMarkingId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    const activated = result.result?.activated_expiry as string | null;
    toast.success(present ? "Marked attended" : "Marked no-show");
    if (activated) {
      toast.info(
        `Package activated — valid until ${formatInTimeZone(activated, timezone, "d MMM yyyy")}. Send the member the activation WhatsApp from their profile.`
      );
    }
    router.refresh();
  }

  const seatHolders = bookings.filter((b) =>
    ["booked", "pass_makeup", "attended", "no_show", "offered"].includes(b.status)
  );
  const liveRows = bookings.filter((b) =>
    ["booked", "pass_makeup", "attended", "no_show"].includes(b.status)
  );
  const waitlistRows = bookings
    .filter((b) => ["waitlisted", "offered"].includes(b.status))
    .sort((a, b) => (a.waitlist_position ?? 99) - (b.waitlist_position ?? 99));

  const bookedClientIds = new Set(
    bookings
      .filter((b) =>
        ["booked", "waitlisted", "offered", "attended", "no_show", "pass_makeup"].includes(
          b.status
        )
      )
      .map((b) => b.client_id)
  );
  const bookableClients = clients.filter((c) => !bookedClientIds.has(c.id));

  const fundingPreview = useMemo(() => {
    if (!selectedClientId) return null;
    const clientInstances = instances.filter(
      (i) => i.client_id === selectedClientId
    );
    const eligible = orderEligibleInstances(
      clientInstances,
      classTypeId,
      classTypeCreditCost
    );
    if (!eligible.length) return { eligible: false as const };
    const first = eligible[0];
    return {
      eligible: true as const,
      packageName: first.packageName,
      cost: classCreditCost(first.scope, classTypeCreditCost),
      balance: first.balance,
    };
  }, [selectedClientId, instances, classTypeId, classTypeCreditCost]);

  const isFull = seatHolders.length >= capacity;
  const availablePass = passes.find(
    (p) => p.client_id === selectedClientId && p.status === "available"
  );

  async function handleBook() {
    if (!selectedClientId) return;
    setBooking(true);
    const result = await bookClassAction({
      classSessionId: sessionId,
      clientId: selectedClientId,
      gracePassId: usePass && availablePass ? availablePass.id : undefined,
    });
    setBooking(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    const status = result.result?.status as string;
    toast.success(
      status === "waitlisted"
        ? `Added to waitlist (position ${result.result?.waitlist_position})`
        : status === "pass_makeup"
          ? "Booked with make-up pass"
          : "Booked"
    );
    setBookOpen(false);
    setSelectedClientId("");
    setUsePass(false);
    router.refresh();
  }

  function cancelOutcome(target: RosterBooking) {
    return cancellationOutcome(
      new Date(),
      new Date(sessionInfo.startAt),
      cutoffHours
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>
            Roster{" "}
            <span className="text-muted-foreground font-normal">
              {seatHolders.length}/{capacity}
              {isFull && " · full"}
            </span>
          </CardTitle>
          {isAdmin && (
          <Dialog open={bookOpen} onOpenChange={setBookOpen}>
            <DialogTrigger>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1.5" aria-hidden />
                Book a member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Book a member</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Member</Label>
                  <Select
                    value={selectedClientId}
                    onValueChange={(v) => v && setSelectedClientId(v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a member" />
                    </SelectTrigger>
                    <SelectContent>
                      {bookableClients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedClientId && availablePass && !isFull && (
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">Use make-up pass</p>
                      <p className="text-xs text-muted-foreground">
                        No credits used — must be a different class type than
                        the missed class
                      </p>
                    </div>
                    <Switch checked={usePass} onCheckedChange={setUsePass} />
                  </div>
                )}

                {selectedClientId && !usePass && (
                  <div className="rounded-lg border p-3 text-sm">
                    {isFull ? (
                      <p className="text-muted-foreground">
                        Class is full — this member will join the{" "}
                        <strong>waitlist</strong> (no credits used until a spot
                        is claimed).
                      </p>
                    ) : fundingPreview?.eligible ? (
                      <p>
                        Will use{" "}
                        <strong>{fundingPreview.packageName}</strong> —{" "}
                        <strong>{fundingPreview.cost} credit
                        {fundingPreview.cost === 1 ? "" : "s"}</strong>{" "}
                        <span className="text-muted-foreground">
                          ({fundingPreview.balance} left)
                        </span>
                      </p>
                    ) : (
                      <p className="text-destructive">
                        No eligible package with enough credits — sell a package
                        first.
                      </p>
                    )}
                  </div>
                )}

                <Button
                  className="w-full"
                  disabled={
                    !selectedClientId ||
                    booking ||
                    (!isFull && !usePass && !fundingPreview?.eligible)
                  }
                  onClick={handleBook}
                >
                  {booking && (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  )}
                  {isFull ? "Add to waitlist" : usePass ? "Book with pass" : "Book"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          )}
        </CardHeader>
        <CardContent>
          {!liveRows.length ? (
            <p className="text-sm text-muted-foreground">No bookings yet.</p>
          ) : (
            <ul className="divide-y">
              {liveRows.map((row) => {
                const name = row.clients?.full_name ?? "Member";
                const confirmLink = waLink(
                  row.clients?.phone ?? null,
                  waTemplates.bookingConfirmation(name, {
                    ...sessionInfo,
                    timezone,
                  })
                );
                return (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{name}</p>
                      <p className="text-sm text-muted-foreground">
                        {STATUS_LABELS[row.status]}
                        {row.credit_cost_snapshot
                          ? ` · ${row.credit_cost_snapshot} credit${row.credit_cost_snapshot === 1 ? "" : "s"}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {attendanceOpen &&
                        ["booked", "pass_makeup"].includes(row.status) && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={markingId === row.id}
                              aria-label={`Mark ${name} attended`}
                              onClick={() => handleMark(row, true)}
                            >
                              {markingId === row.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4 mr-1" />
                              )}
                              Present
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={markingId === row.id}
                              aria-label={`Mark ${name} absent`}
                              className="text-muted-foreground"
                              onClick={() => handleMark(row, false)}
                            >
                              <UserX className="h-4 w-4 mr-1" />
                              Absent
                            </Button>
                          </>
                        )}
                      {isAdmin &&
                        ["attended", "no_show"].includes(row.status) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Revert attendance for ${name}`}
                            onClick={() => {
                              setRevertReason("");
                              setReverting(row);
                            }}
                          >
                            <Undo2 className="h-4 w-4" />
                          </Button>
                        )}
                      {isAdmin && confirmLink && row.status === "booked" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`WhatsApp confirmation to ${name}`}
                          onClick={() => window.open(confirmLink, "_blank")}
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      )}
                      {isAdmin &&
                        ["booked", "pass_makeup"].includes(row.status) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Cancel booking for ${name}`}
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => setCancelling(row)}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {waitlistRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Hourglass className="h-5 w-5" aria-hidden />
              Waitlist
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {waitlistRows.map((row) => {
                const name = row.clients?.full_name ?? "Member";
                const offerExpired =
                  row.status === "offered" &&
                  !!row.offer_expires_at &&
                  new Date(row.offer_expires_at) <= new Date();
                const offerLink =
                  row.status === "offered" && row.offer_expires_at
                    ? waLink(
                        row.clients?.phone ?? null,
                        waTemplates.waitlistOffer(
                          name,
                          { ...sessionInfo, timezone },
                          row.offer_expires_at
                        )
                      )
                    : null;
                return (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <p className="font-medium">{name}</p>
                      <p
                        className={`text-sm ${offerExpired ? "text-destructive" : "text-muted-foreground"}`}
                      >
                        {row.status === "offered" && row.offer_expires_at
                          ? offerExpired
                            ? "Offer expired — claim, re-offer, or release"
                            : `Offered — claim by ${formatInTimeZone(row.offer_expires_at, timezone, "h:mm a")}`
                          : `Position ${row.waitlist_position}`}
                      </p>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        {row.status === "waitlisted" && !isFull && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              const result = await offerWaitlistSpotAction({
                                bookingId: row.id,
                                classSessionId: sessionId,
                              });
                              if (result.error) {
                                toast.error(result.error);
                                return;
                              }
                              toast.success(
                                `Spot offered to ${name} — send them the WhatsApp offer`
                              );
                              router.refresh();
                            }}
                          >
                            Offer spot
                          </Button>
                        )}
                        {row.status === "offered" && (
                          <>
                            {offerLink && !offerExpired && (
                              <Button
                                size="sm"
                                aria-label={`WhatsApp offer to ${name}`}
                                onClick={() => window.open(offerLink, "_blank")}
                              >
                                <MessageCircle className="h-4 w-4 mr-1" />
                                Send offer
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                const result = await claimWaitlistOfferAction({
                                  bookingId: row.id,
                                  classSessionId: sessionId,
                                });
                                if (result.error) {
                                  toast.error(result.error);
                                  return;
                                }
                                toast.success(`${name} is booked in`);
                                router.refresh();
                              }}
                            >
                              Claim
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                const result = await releaseWaitlistOfferAction({
                                  bookingId: row.id,
                                  classSessionId: sessionId,
                                });
                                if (result.error) {
                                  toast.error(result.error);
                                  return;
                                }
                                toast.success(
                                  "Offer released — the member moved to the back of the queue"
                                );
                                router.refresh();
                              }}
                            >
                              Release
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={!!cancelling}
        onOpenChange={(open) => {
          if (!open) setCancelling(null);
        }}
        title="Cancel this booking?"
        description={
          cancelling
            ? cancelOutcome(cancelling) === "refund"
              ? `Cancelling more than ${cutoffHours}h before class — the credit will be returned to ${cancelling.clients?.full_name ?? "the member"}'s package.`
              : `Within ${cutoffHours}h of class start — the credit will be FORFEITED per the cancellation policy.`
            : undefined
        }
        confirmLabel="Cancel booking"
        destructive
        onConfirm={async () => {
          if (!cancelling) return;
          const result = await cancelBookingAction({
            bookingId: cancelling.id,
            classSessionId: sessionId,
          });
          if (result?.error) return { error: result.error };
          const outcome = result.result?.outcome as string;
          const offer = result.result?.offer as { client_id?: string } | null;
          toast.success(
            outcome === "refunded"
              ? "Cancelled — credit refunded"
              : "Cancelled — credit forfeited"
          );
          if (offer) {
            toast.info(
              "A waitlisted member has been offered the freed seat — send them the WhatsApp offer from the waitlist."
            );
          }
          router.refresh();
        }}
      />

      <Dialog
        open={!!reverting}
        onOpenChange={(open) => {
          if (!open) setReverting(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Revert attendance for {reverting?.clients?.full_name ?? "member"}?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The booking returns to its pre-attendance state; any commission is
              reversed with a compensating entry. A reason is required and goes
              to the ledger.
            </p>
            <div className="space-y-2">
              <Label htmlFor="revert-reason">Reason</Label>
              <Textarea
                id="revert-reason"
                value={revertReason}
                onChange={(e) => setRevertReason(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              disabled={!revertReason.trim()}
              onClick={async () => {
                if (!reverting) return;
                const result = await revertAttendanceAction({
                  bookingId: reverting.id,
                  classSessionId: sessionId,
                  reason: revertReason,
                });
                if (result.error) {
                  toast.error(result.error);
                  return;
                }
                toast.success("Attendance reverted");
                setReverting(null);
                router.refresh();
              }}
            >
              Revert attendance
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
