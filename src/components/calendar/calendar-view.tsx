"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addDays,
  format,
  parseISO,
  startOfWeek,
  endOfWeek,
  isSameDay,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/constants";
import {
  createAppointmentAction,
  updateAppointmentStatusAction,
} from "@/actions/dashboard";
import type {
  Appointment,
  BusinessMember,
  Client,
  Service,
  Business,
} from "@/types/database";
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

function appointmentLabel(appointment: AppointmentWithRelations) {
  const client = appointment.clients?.full_name ?? "Unknown client";
  const service = appointment.services?.name ?? "Service";
  const time = format(parseISO(appointment.start_at), "h:mm a");
  const status = APPOINTMENT_STATUS_LABELS[appointment.status];
  return `${client}, ${service}, ${time}, ${status}`;
}

function NewAppointmentDialog({
  clients,
  services,
  staff,
  defaultStart,
}: {
  business: Business;
  clients: Client[];
  services: Service[];
  staff: BusinessMember[];
  defaultStart?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [startAt, setStartAt] = useState(defaultStart ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    setError(null);
    if (!clientId || !serviceId || !staffId || !startAt) {
      setError("All fields are required");
      return;
    }
    setLoading(true);
    const result = await createAppointmentAction({
      clientId,
      serviceId,
      staffMemberId: staffId,
      startAt: new Date(startAt).toISOString(),
    });
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button>
          <Plus className="h-4 w-4 mr-2" aria-hidden />
          New appointment
        </Button>
      </DialogTrigger>
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
            <Select value={serviceId} onValueChange={(v) => v && setServiceId(v)}>
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
            <Label htmlFor="new-apt-datetime">Date & time</Label>
            <Input
              id="new-apt-datetime"
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
            />
          </div>
          <Button onClick={handleCreate} className="w-full" disabled={loading} aria-busy={loading}>
            {loading ? "Creating..." : "Create appointment"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AppointmentDetailDialog({ appointment }: { appointment: AppointmentWithRelations }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<Appointment["status"] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <button
          type="button"
          aria-label={appointmentLabel(appointment)}
          className={cn(
            "w-full rounded-md border p-2 min-h-11 text-left text-xs motion-reduce:transition-none transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            STATUS_CLASSES[appointment.status]
          )}
        >
          <p className="font-medium truncate">
            {appointment.clients?.full_name}
          </p>
          <p className="truncate opacity-80">{appointment.services?.name}</p>
          <p className="opacity-70">
            {format(parseISO(appointment.start_at), "h:mm a")}
          </p>
        </button>
      </DialogTrigger>
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
            {format(parseISO(appointment.start_at), "EEE, MMM d · h:mm a")} –{" "}
            {format(parseISO(appointment.end_at), "h:mm a")}
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
}: {
  weekDays: Date[];
  appointments: AppointmentWithRelations[];
}) {
  return (
    <div className="md:hidden space-y-4" aria-label="Week agenda">
      {weekDays.map((day) => {
        const dayAppointments = appointments
          .filter((apt) => isSameDay(parseISO(apt.start_at), day))
          .sort(
            (a, b) =>
              parseISO(a.start_at).getTime() - parseISO(b.start_at).getTime()
          );

        return (
          <div
            key={day.toISOString()}
            className={cn(
              "rounded-lg border bg-card p-3",
              isSameDay(day, new Date()) && "border-primary/30 bg-accent/30"
            )}
          >
            <h3 className="font-semibold text-sm mb-2">
              {format(day, "EEE, MMM d")}
              {isSameDay(day, new Date()) && (
                <span className="ml-2 text-xs font-normal text-primary">Today</span>
              )}
            </h3>
            {dayAppointments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No appointments</p>
            ) : (
              <ul className="space-y-2">
                {dayAppointments.map((apt) => (
                  <li key={apt.id}>
                    <AppointmentDetailDialog appointment={apt} />
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
  appointments,
  clients,
  services,
  staff,
}: {
  business: Business;
  appointments: AppointmentWithRelations[];
  clients: Client[];
  services: Service[];
  staff: BusinessMember[];
}) {
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 0 })
  );
  const [staffFilter, setStaffFilter] = useState<string>("all");

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });

  const filteredAppointments = appointments.filter((apt) => {
    const start = parseISO(apt.start_at);
    const inWeek = start >= weekStart && start <= weekEnd;
    const matchesStaff =
      staffFilter === "all" || apt.staff_member_id === staffFilter;
    return inWeek && matchesStaff;
  });

  const hours = Array.from({ length: 12 }, (_, i) => i + 8);

  const hasData = services.length > 0 && staff.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description={`${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={staffFilter} onValueChange={(v) => v && setStaffFilter(v)}>
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
              onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }))}
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
              <NewAppointmentDialog
                business={business}
                clients={clients}
                services={services}
                staff={staff.filter((s) => s.is_bookable)}
              />
            )}
          </div>
        }
      />

      {!hasData ? (
        <CalendarEmpty />
      ) : (
        <>
          <MobileAgenda weekDays={weekDays} appointments={filteredAppointments} />

          <div
            className="hidden md:block overflow-x-auto rounded-lg border bg-card"
            aria-label={`Week of ${format(weekStart, "MMM d, yyyy")}`}
          >
            <div className="grid min-w-[800px]" style={{ gridTemplateColumns: "60px repeat(7, 1fr)" }}>
              <div className="border-b border-r p-2" />
              {weekDays.map((day) => (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "border-b border-r p-2 text-center text-sm font-medium",
                    isSameDay(day, new Date()) && "bg-accent/50"
                  )}
                >
                  <div>{format(day, "EEE")}</div>
                  <div className="text-muted-foreground">{format(day, "d")}</div>
                </div>
              ))}
              {hours.flatMap((hour) => [
                <div
                  key={`label-${hour}`}
                  className="border-b border-r p-2 text-xs text-muted-foreground"
                >
                  {format(new Date().setHours(hour, 0), "ha")}
                </div>,
                ...weekDays.map((day) => {
                  const slotAppointments = filteredAppointments.filter((apt) => {
                    const start = parseISO(apt.start_at);
                    return isSameDay(start, day) && start.getHours() === hour;
                  });
                  return (
                    <div
                      key={`${day.toISOString()}-${hour}`}
                      className={cn(
                        "border-b border-r p-1 min-h-[72px] space-y-1",
                        isSameDay(day, new Date()) && "bg-accent/50"
                      )}
                    >
                      {slotAppointments.map((apt) => (
                        <AppointmentDetailDialog key={apt.id} appointment={apt} />
                      ))}
                    </div>
                  );
                }),
              ])}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
