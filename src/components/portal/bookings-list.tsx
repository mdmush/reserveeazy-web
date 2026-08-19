"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { toast } from "sonner";
import { memberCancelAction } from "@/actions/member";
import { cancellationOutcome } from "@/lib/credit-engine";
import { nowMs } from "@/lib/clock";
import type { BookingStatus } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export type MemberBookingRow = {
  booking_id: string;
  client_id: string;
  client_name: string;
  status: BookingStatus;
  credit_cost_snapshot: number | null;
  waitlist_position: number | null;
  offer_expires_at: string | null;
  session_id: string;
  type_name: string;
  start_at: string;
  end_at: string;
  room: string | null;
  teacher_name: string;
};

const STATUS_LABELS: Record<BookingStatus, string> = {
  booked: "Booked",
  pass_makeup: "Booked (pass)",
  waitlisted: "Waitlisted",
  offered: "Spot offered",
  cancelled_early: "Cancelled",
  cancelled_late: "Late cancel",
  attended: "Attended",
  no_show: "Missed",
};

const STATUS_BADGE: Record<
  BookingStatus,
  "success" | "secondary" | "outline" | "destructive"
> = {
  booked: "success",
  pass_makeup: "success",
  waitlisted: "outline",
  offered: "secondary",
  cancelled_early: "secondary",
  cancelled_late: "destructive",
  attended: "success",
  no_show: "destructive",
};

export function BookingsList({
  slug,
  bookings,
  showClientNames,
  timezone,
}: {
  slug: string;
  bookings: MemberBookingRow[];
  showClientNames: boolean;
  timezone: string;
}) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState<MemberBookingRow | null>(null);

  const now = nowMs();
  const upcoming = bookings
    .filter(
      (b) =>
        new Date(b.start_at).getTime() > now &&
        ["booked", "pass_makeup", "waitlisted", "offered"].includes(b.status)
    )
    .sort((a, b) => a.start_at.localeCompare(b.start_at));
  const history = bookings.filter((b) => !upcoming.includes(b));

  function renderRow(booking: MemberBookingRow, cancellable: boolean) {
    return (
      <li
        key={booking.booking_id}
        className="flex items-center justify-between gap-3 py-3"
      >
        <div className="min-w-0">
          <p className="font-medium">
            {booking.type_name}
            {showClientNames && (
              <span className="text-muted-foreground font-normal">
                {" "}
                · {booking.client_name}
              </span>
            )}
          </p>
          <p className="text-sm text-muted-foreground">
            {formatInTimeZone(booking.start_at, timezone, "EEE d MMM, h:mm a")} ·{" "}
            {booking.teacher_name}
            {booking.room ? ` · ${booking.room}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={STATUS_BADGE[booking.status]}>
            {booking.status === "waitlisted" && booking.waitlist_position
              ? `Waitlist #${booking.waitlist_position}`
              : STATUS_LABELS[booking.status]}
          </Badge>
          {cancellable && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => setCancelling(booking)}
            >
              Cancel
            </Button>
          )}
        </div>
      </li>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upcoming</CardTitle>
        </CardHeader>
        <CardContent>
          {!upcoming.length ? (
            <p className="text-sm text-muted-foreground">
              Nothing booked — browse the schedule to grab a spot.
            </p>
          ) : (
            <ul className="divide-y">{upcoming.map((b) => renderRow(b, true))}</ul>
          )}
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>History</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">{history.map((b) => renderRow(b, false))}</ul>
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
            ? ["waitlisted", "offered"].includes(cancelling.status)
              ? "You'll be removed from the waitlist."
              : cancellationOutcome(
                    new Date(),
                    new Date(cancelling.start_at),
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
            bookingId: cancelling.booking_id,
            clientId: cancelling.client_id,
          });
          if (result?.error) return { error: result.error };
          toast.success(
            (result.result?.outcome as string) === "refunded"
              ? "Cancelled — credit returned"
              : "Cancelled"
          );
          router.refresh();
        }}
      />
    </div>
  );
}
