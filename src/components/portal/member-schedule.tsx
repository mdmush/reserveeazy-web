"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { ChevronLeft, ChevronRight, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import {
  memberBookAction,
  memberCancelAction,
  memberClaimOfferAction,
} from "@/actions/member";
import {
  classCreditCost,
  orderEligibleInstances,
  cancellationOutcome,
  type FundableInstance,
} from "@/lib/credit-engine";
import { formatPrice } from "@/lib/format";
import type { BookingStatus, PricingMode } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/link-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type MemberSession = {
  id: string;
  class_type_id: string;
  type_name: string;
  credit_cost: number;
  drop_in_price_cents: number;
  start_at: string;
  end_at: string;
  room: string | null;
  capacity: number;
  teacher_name: string;
  seats_taken: number;
  my_bookings: {
    booking_id: string;
    client_id: string;
    status: BookingStatus;
    waitlist_position: number | null;
    offer_expires_at: string | null;
  }[];
};

export type MemberInstance = FundableInstance & { packageName: string };

export function MemberSchedule({
  slug,
  sessions,
  instances,
  actingClients,
  selfClientId,
  pricingMode,
  weekStart,
  todayLocal,
  timezone,
}: {
  slug: string;
  sessions: MemberSession[];
  instances: MemberInstance[];
  actingClients: { id: string; full_name: string }[];
  selfClientId: string;
  pricingMode: PricingMode;
  weekStart: string;
  todayLocal: string;
  timezone: string;
}) {
  const router = useRouter();
  const [actingId, setActingId] = useState(selfClientId);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<{
    session: MemberSession;
    bookingId: string;
  } | null>(null);

  const prevWeek = format(addDays(parseISO(weekStart), -7), "yyyy-MM-dd");
  const nextWeek = format(addDays(parseISO(weekStart), 7), "yyyy-MM-dd");

  const sessionsByDay = new Map<string, MemberSession[]>();
  for (const session of sessions) {
    const day = formatInTimeZone(session.start_at, timezone, "yyyy-MM-dd");
    sessionsByDay.set(day, [...(sessionsByDay.get(day) ?? []), session]);
  }
  const days = [...sessionsByDay.keys()].sort();

  function costPreview(session: MemberSession): string | null {
    if (pricingMode === "pay_per_class") {
      return session.drop_in_price_cents > 0
        ? `${formatPrice(session.drop_in_price_cents, "MYR")} — pay at the studio`
        : null;
    }
    const mine = instances.filter((i) => i.client_id === actingId);
    const eligible = orderEligibleInstances(
      mine,
      session.class_type_id,
      session.credit_cost
    );
    if (!eligible.length) return "No credits — top up at the front desk";
    const first = eligible[0];
    const cost = classCreditCost(first.scope, session.credit_cost);
    return `${cost} credit${cost === 1 ? "" : "s"} from ${first.packageName}`;
  }

  async function handleBook(session: MemberSession) {
    setBusyId(session.id);
    const result = await memberBookAction({
      slug,
      sessionId: session.id,
      clientId: actingId,
    });
    setBusyId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    const status = result.result?.status as string;
    toast.success(
      status === "waitlisted"
        ? `You're on the waitlist (position ${result.result?.waitlist_position})`
        : "Booked — see you in class!"
    );
    router.refresh();
  }

  async function handleClaim(session: MemberSession, bookingId: string) {
    setBusyId(session.id);
    const result = await memberClaimOfferAction({
      slug,
      bookingId,
      clientId: actingId,
    });
    setBusyId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Spot claimed — you're booked!");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {actingClients.length > 1 && (
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">Booking for</Label>
          <Select value={actingId} onValueChange={(v) => v && setActingId(v)}>
            <SelectTrigger className="h-8 w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {actingClients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.full_name}
                  {client.id === selfClientId ? " (you)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex items-center gap-2">
        <LinkButton
          variant="outline"
          size="sm"
          href={`/portal/${slug}/schedule?week=${prevWeek}`}
          aria-label="Previous week"
        >
          <ChevronLeft className="h-4 w-4" />
        </LinkButton>
        <span className="px-2 text-sm font-semibold">
          {format(parseISO(weekStart), "d MMM")} –{" "}
          {format(addDays(parseISO(weekStart), 6), "d MMM yyyy")}
        </span>
        <LinkButton
          variant="outline"
          size="sm"
          href={`/portal/${slug}/schedule?week=${nextWeek}`}
          aria-label="Next week"
        >
          <ChevronRight className="h-4 w-4" />
        </LinkButton>
      </div>

      {!days.length ? (
        <p className="text-sm text-muted-foreground">
          No classes scheduled this week — try the next one.
        </p>
      ) : (
        days.map((day) => (
          <div key={day} className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground">
              {format(parseISO(day), "EEEE d MMM")}
              {day === todayLocal && (
                <Badge className="ml-2" variant="success">
                  Today
                </Badge>
              )}
            </h2>
            <div className="grid gap-2">
              {(sessionsByDay.get(day) ?? []).map((session) => {
                const mine = session.my_bookings.find(
                  (b) => b.client_id === actingId
                );
                const seatsLeft = session.capacity - session.seats_taken;
                const past = new Date(session.start_at) <= new Date();
                const busy = busyId === session.id;
                const preview = costPreview(session);

                return (
                  <div
                    key={session.id}
                    className="rounded-2xl border bg-card p-4 shadow-soft"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold">{session.type_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatInTimeZone(session.start_at, timezone, "h:mm a")} –{" "}
                          {formatInTimeZone(session.end_at, timezone, "h:mm a")} ·{" "}
                          {session.teacher_name}
                          {session.room ? ` · ${session.room}` : ""}
                        </p>
                        {!mine && !past && preview && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {preview}
                          </p>
                        )}
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" aria-hidden />
                        {seatsLeft > 0 ? `${seatsLeft} left` : "Full"}
                      </span>
                    </div>

                    {!past && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {!mine ? (
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() => handleBook(session)}
                          >
                            {busy && (
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            )}
                            {seatsLeft > 0 ? "Book" : "Join waitlist"}
                          </Button>
                        ) : mine.status === "offered" ? (
                          <>
                            <Badge variant="success">
                              Spot offered
                              {mine.offer_expires_at &&
                                ` — claim by ${formatInTimeZone(mine.offer_expires_at, timezone, "h:mm a")}`}
                            </Badge>
                            <Button
                              size="sm"
                              disabled={busy}
                              onClick={() => handleClaim(session, mine.booking_id)}
                            >
                              {busy && (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                              )}
                              Claim spot
                            </Button>
                          </>
                        ) : mine.status === "waitlisted" ? (
                          <Badge variant="outline">
                            Waitlist position {mine.waitlist_position}
                          </Badge>
                        ) : (
                          <Badge variant="success">
                            {mine.status === "pass_makeup" ? "Booked (pass)" : "Booked"}
                          </Badge>
                        )}
                        {mine &&
                          ["booked", "pass_makeup", "waitlisted", "offered"].includes(
                            mine.status
                          ) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground"
                              onClick={() =>
                                setCancelling({
                                  session,
                                  bookingId: mine.booking_id,
                                })
                              }
                            >
                              Cancel
                            </Button>
                          )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      <ConfirmDialog
        open={!!cancelling}
        onOpenChange={(open) => {
          if (!open) setCancelling(null);
        }}
        title="Cancel this booking?"
        description={
          cancelling
            ? ["waitlisted", "offered"].includes(
                cancelling.session.my_bookings.find(
                  (b) => b.booking_id === cancelling.bookingId
                )?.status ?? ""
              )
              ? "You'll be removed from the waitlist."
              : cancellationOutcome(
                    new Date(),
                    new Date(cancelling.session.start_at),
                    24
                  ) === "refund"
                ? "You're cancelling in time — your credit will be returned."
                : "The class starts soon, so this credit will be used per the studio's cancellation policy."
            : undefined
        }
        confirmLabel="Cancel booking"
        destructive
        onConfirm={async () => {
          if (!cancelling) return;
          const result = await memberCancelAction({
            slug,
            bookingId: cancelling.bookingId,
            clientId: actingId,
          });
          if (result?.error) return { error: result.error };
          const outcome = result.result?.outcome as string;
          toast.success(
            outcome === "refunded"
              ? "Cancelled — credit returned"
              : outcome === "removed_from_waitlist"
                ? "Removed from the waitlist"
                : "Cancelled"
          );
          router.refresh();
        }}
      />
    </div>
  );
}
