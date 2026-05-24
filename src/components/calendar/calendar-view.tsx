"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addDays,
  format,
  parseISO,
  startOfWeek,
  endOfWeek,
  isSameDay,
} from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/constants";
import {
  createAppointmentAction,
  updateAppointmentStatusAction,
} from "@/actions/dashboard";
import type {
  Appointment,
  BusinessHours,
  BusinessMember,
  Client,
  Service,
  Business,
} from "@/types/database";
import {
  appointmentInWeek,
  formatInBusinessTimezone,
  getOpenSlotOptionsForDay,
  isSameBusinessDay,
  dateStringToLocalDay,
  slotToDatetimeLocalValue,
} from "@/lib/calendar/grid";
import { formatSlot } from "@/lib/booking/slots";
import { CalendarWeekView } from "@/components/calendar/calendar-week-view";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CalendarEmpty } from "@/components/dashboard/empty-states";
import { PageHeader } from "@/components/dashboard/page-header";

type AppointmentWithRelations = Appointment & {
  clients: Client | null;
  services: Service | null;
  business_members: BusinessMember | null;
};

const STATUS_CLASSES: Record<string, string> = {
  pending: "status-pending",
  confirmed: "status-confirmed",
  cancelled: "status-cancelled",
  completed: "status-completed",
  no_show: "status-no-show",
};

function appointmentLabel(
  appointment: AppointmentWithRelations,
  timezone: string,
) {
  const client = appointment.clients?.full_name ?? "Unknown client";
  const service = appointment.services?.name ?? "Service";
  const time = formatSlot(appointment.start_at, timezone);
  const status = APPOINTMENT_STATUS_LABELS[appointment.status];
  return `${client}, ${service}, ${time}, ${status}`;
}

type SelectedSlot = { day: Date; slotMinutes: number };

function NewAppointmentDialog({
  clients,
  services,
  staff,
  businessHours,
  timezone,
  slotIntervalMinutes,
  open,
  onOpenChange,
  initialSlot,
}: {
  clients: Client[];
  services: Service[];
  staff: BusinessMember[];
  businessHours: BusinessHours[];
  timezone: string;
  slotIntervalMinutes: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSlot: SelectedSlot | null;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlotMinutes, setSelectedSlotMinutes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const slotOptions = useMemo(() => {
    if (!selectedDate) return [];
    return getOpenSlotOptionsForDay(
      dateStringToLocalDay(selectedDate),
      businessHours,
      slotIntervalMinutes,
    );
  }, [selectedDate, businessHours, slotIntervalMinutes]);

  useEffect(() => {
    if (!open) return;

    if (initialSlot) {
      setSelectedDate(format(initialSlot.day, "yyyy-MM-dd"));
      setSelectedSlotMinutes(String(initialSlot.slotMinutes));
    } else {
      setSelectedDate(format(new Date(), "yyyy-MM-dd"));
      setSelectedSlotMinutes("");
    }
    setError(null);
  }, [open, initialSlot]);

  useEffect(() => {
    if (!selectedSlotMinutes || !selectedDate) return;

    const minutes = Number(selectedSlotMinutes);
    const day = dateStringToLocalDay(selectedDate);
    const isValid = slotOptions.some((slot) => slot.minutes === minutes);

    if (!isValid) {
      setSelectedSlotMinutes("");
    }
  }, [selectedDate, slotOptions, selectedSlotMinutes]);

  async function handleCreate() {
    setError(null);
    if (!clientId || !serviceId || !staffId || !selectedDate || !selectedSlotMinutes) {
      setError("All fields are required");
      return;
    }

    const day = dateStringToLocalDay(selectedDate);
    const startAt = slotToDatetimeLocalValue(day, Number(selectedSlotMinutes));

    setLoading(true);
    const result = await createAppointmentAction({
      clientId,
      serviceId,
      staffMemberId: staffId,
      startAt: fromZonedTime(startAt, timezone).toISOString(),
    });
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New appointment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="new-apt-client">Client</Label>
            <Select value={clientId} onValueChange={(v) => v && setClientId(v)}>
              <SelectTrigger id="new-apt-client" aria-label="Select client">
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-apt-service">Service</Label>
            <Select
              value={serviceId}
              onValueChange={(v) => v && setServiceId(v)}
            >
              <SelectTrigger id="new-apt-service" aria-label="Select service">
                <SelectValue placeholder="Select service" />
              </SelectTrigger>
              <SelectContent>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-apt-staff">Staff</Label>
            <Select value={staffId} onValueChange={(v) => v && setStaffId(v)}>
              <SelectTrigger id="new-apt-staff" aria-label="Select staff">
                <SelectValue placeholder="Select staff" />
              </SelectTrigger>
              <SelectContent>
                {staff.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-apt-date">Date</Label>
            <Input
              id="new-apt-date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-apt-slot">Time slot</Label>
            <Select
              value={selectedSlotMinutes}
              onValueChange={(v) => v && setSelectedSlotMinutes(v)}
            >
              <SelectTrigger id="new-apt-slot" aria-label="Select time slot">
                <SelectValue placeholder="Select time slot" />
              </SelectTrigger>
              <SelectContent>
                {slotOptions.length === 0 ? (
                  <SelectItem value="__none" disabled>
                    No slots on this day
                  </SelectItem>
                ) : (
                  slotOptions.map((slot) => (
                    <SelectItem key={slot.minutes} value={String(slot.minutes)}>
                      {slot.label}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleCreate}
            className="w-full"
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? "Creating..." : "Create appointment"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AppointmentDetailDialog({
  appointment,
  timezone,
  compact = false,
  open,
  onOpenChange,
}: {
  appointment: AppointmentWithRelations;
  timezone: string;
  compact?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<
    Appointment["status"] | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  const isControlled = open !== undefined;
  const dialogOpen = isControlled ? open : internalOpen;
  const setDialogOpen = isControlled ? onOpenChange! : setInternalOpen;

  async function updateStatus(status: Appointment["status"]) {
    setLoadingStatus(status);
    setError(null);
    const result = await updateAppointmentStatusAction(appointment.id, status);
    setLoadingStatus(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
    setDialogOpen(false);
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {!isControlled && (
        <DialogTrigger>
          <button
            type="button"
            aria-label={appointmentLabel(appointment, timezone)}
            className={cn(
              "w-full rounded-md border text-left motion-reduce:transition-none transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              compact
                ? "px-1.5 py-1 text-[11px] leading-snug"
                : "p-2 min-h-11 text-xs",
              STATUS_CLASSES[appointment.status],
            )}
          >
            <p className="font-medium truncate">
              {appointment.clients?.full_name}
            </p>
            {!compact && (
              <p className="truncate opacity-80">
                {appointment.services?.name}
              </p>
            )}
            <p
              className={cn(
                "truncate",
                compact ? "text-muted-foreground" : "opacity-70",
              )}
            >
              {compact
                ? `${appointment.services?.name ?? "Service"} · ${formatSlot(appointment.start_at, timezone)}`
                : formatSlot(appointment.start_at, timezone)}
            </p>
          </button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Appointment details</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <p>
            <span className="text-muted-foreground">Client:</span>{" "}
            {appointment.clients?.full_name}
          </p>
          <p>
            <span className="text-muted-foreground">Service:</span>{" "}
            {appointment.services?.name}
          </p>
          <p>
            <span className="text-muted-foreground">Staff:</span>{" "}
            {appointment.business_members?.display_name}
          </p>
          <p>
            <span className="text-muted-foreground">When:</span>{" "}
            {formatInBusinessTimezone(
              appointment.start_at,
              timezone,
              "EEE, MMM d · h:mm a",
            )}{" "}
            – {formatSlot(appointment.end_at, timezone)}
          </p>
          <Badge variant="secondary">
            {APPOINTMENT_STATUS_LABELS[appointment.status]}
          </Badge>
          <div className="flex flex-wrap gap-2 pt-2">
            {appointment.status !== "confirmed" && (
              <Button
                size="sm"
                disabled={!!loadingStatus}
                aria-busy={loadingStatus === "confirmed"}
                onClick={() => updateStatus("confirmed")}
              >
                Confirm
              </Button>
            )}
            {appointment.status !== "completed" && (
              <Button
                size="sm"
                variant="outline"
                disabled={!!loadingStatus}
                aria-busy={loadingStatus === "completed"}
                onClick={() => updateStatus("completed")}
              >
                Complete
              </Button>
            )}
            {appointment.status !== "cancelled" && (
              <Button
                size="sm"
                variant="destructive"
                disabled={!!loadingStatus}
                aria-busy={loadingStatus === "cancelled"}
                onClick={() => updateStatus("cancelled")}
              >
                Cancel
              </Button>
            )}
            {appointment.status !== "no_show" && (
              <Button
                size="sm"
                variant="outline"
                disabled={!!loadingStatus}
                aria-busy={loadingStatus === "no_show"}
                onClick={() => updateStatus("no_show")}
              >
                No show
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MobileAgenda({
  weekDays,
  appointments,
  timezone,
}: {
  weekDays: Date[];
  appointments: AppointmentWithRelations[];
  timezone: string;
}) {
  return (
    <div className="md:hidden space-y-4" aria-label="Week agenda">
      {weekDays.map((day) => {
        const dayAppointments = appointments
          .filter((apt) => isSameBusinessDay(apt.start_at, day, timezone))
          .sort(
            (a, b) =>
              parseISO(a.start_at).getTime() - parseISO(b.start_at).getTime(),
          );

        return (
          <div
            key={day.toISOString()}
            className={cn(
              "rounded-lg border bg-card p-3",
              isSameDay(day, new Date()) && "border-primary/30 bg-accent/30",
            )}
          >
            <h3 className="font-semibold text-sm mb-2">
              {format(day, "EEE, MMM d")}
              {isSameDay(day, new Date()) && (
                <span className="ml-2 text-xs font-normal text-primary">
                  Today
                </span>
              )}
            </h3>
            {dayAppointments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No appointments</p>
            ) : (
              <ul className="space-y-2">
                {dayAppointments.map((apt) => (
                  <li key={apt.id}>
                    <AppointmentDetailDialog
                      appointment={apt}
                      timezone={timezone}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function CalendarView({
  business,
  businessHours,
  appointments,
  clients,
  services,
  staff,
}: {
  business: Business;
  businessHours: BusinessHours[];
  appointments: AppointmentWithRelations[];
  clients: Client[];
  services: Service[];
  staff: BusinessMember[];
}) {
  const timezone = business.timezone;
  const slotIntervalMinutes = business.settings.slot_interval_minutes;
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 0 }),
  );
  const [staffFilter, setStaffFilter] = useState<string>("all");
  const [selectedAppointment, setSelectedAppointment] =
    useState<AppointmentWithRelations | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [newAppointmentOpen, setNewAppointmentOpen] = useState(false);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  function handleOpenNewAppointment() {
    setSelectedSlot(null);
    setNewAppointmentOpen(true);
  }

  function handleSelectSlot(day: Date, slotMinutes: number) {
    setSelectedSlot({ day, slotMinutes });
    setNewAppointmentOpen(true);
  }

  function handleNewAppointmentOpenChange(open: boolean) {
    setNewAppointmentOpen(open);
    if (!open) {
      setSelectedSlot(null);
    }
  }

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });

  const filteredAppointments = appointments.filter((apt) => {
    const inWeek = appointmentInWeek(apt.start_at, weekDays, timezone);
    const matchesStaff =
      staffFilter === "all" || apt.staff_member_id === staffFilter;
    return inWeek && matchesStaff;
  });

  const hasData = services.length > 0 && staff.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description={`${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={staffFilter}
              onValueChange={(v) => v && setStaffFilter(v)}
            >
              <SelectTrigger className="w-[160px]" aria-label="Filter by staff">
                <SelectValue placeholder="All staff" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All staff</SelectItem>
                {staff.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous week"
              onClick={() => setWeekStart(addDays(weekStart, -7))}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }))
              }
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Next week"
              onClick={() => setWeekStart(addDays(weekStart, 7))}
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
            {hasData && (
              <>
                <Button onClick={handleOpenNewAppointment}>
                  <Plus className="h-4 w-4 mr-2" aria-hidden />
                  New appointment
                </Button>
                <NewAppointmentDialog
                  clients={clients}
                  services={services}
                  staff={staff.filter((s) => s.is_bookable)}
                  businessHours={businessHours}
                  timezone={timezone}
                  slotIntervalMinutes={slotIntervalMinutes}
                  open={newAppointmentOpen}
                  onOpenChange={handleNewAppointmentOpenChange}
                  initialSlot={selectedSlot}
                />
              </>
            )}
          </div>
        }
      />

      {!hasData ? (
        <CalendarEmpty />
      ) : (
        <>
          <MobileAgenda
            weekDays={weekDays}
            appointments={filteredAppointments}
            timezone={timezone}
          />

          <CalendarWeekView
            weekDays={weekDays}
            appointments={filteredAppointments}
            businessHours={businessHours}
            timezone={timezone}
            slotIntervalMinutes={slotIntervalMinutes}
            onSelectAppointment={setSelectedAppointment}
            onSelectSlot={handleSelectSlot}
          />

          {selectedAppointment && (
            <AppointmentDetailDialog
              appointment={selectedAppointment}
              timezone={timezone}
              open
              onOpenChange={(open) => {
                if (!open) setSelectedAppointment(null);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
