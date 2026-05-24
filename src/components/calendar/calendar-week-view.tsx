"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { cn } from "@/lib/utils";
import { formatSlot } from "@/lib/booking/slots";
import {
  appointmentInSlot,
  formatInBusinessTimezone,
  getCalendarRows,
  getCalendarTimeBounds,
  isWithinBusinessHours,
} from "@/lib/calendar/grid";
import type { Appointment, BusinessHours } from "@/types/database";
import type { BusinessMember, Client, Service } from "@/types/database";

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

function formatDayLabel(day: Date) {
  return {
    weekday: format(day, "EEE"),
    date: format(day, "d"),
  };
}

function AppointmentCard({
  appointment,
  timezone,
  onSelect,
}: {
  appointment: AppointmentWithRelations;
  timezone: string;
  onSelect: () => void;
}) {
  const clientName = appointment.clients?.full_name ?? "Client";
  const serviceName = appointment.services?.name ?? "Service";
  const timeRange = `${formatSlot(appointment.start_at, timezone)} – ${formatSlot(appointment.end_at, timezone)}`;

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      aria-label={`${clientName}, ${serviceName}, ${timeRange}`}
      className={cn(
        "w-full rounded-md border px-2 py-1.5 text-left text-[11px] leading-snug shadow-sm motion-reduce:transition-none transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        STATUS_CLASSES[appointment.status]
      )}
    >
      <p className="font-semibold wrap-break-word">{clientName}</p>
      <p className="mt-0.5 wrap-break-word opacity-80">{serviceName}</p>
      <p className="mt-0.5 wrap-break-word text-[10px] opacity-70">{timeRange}</p>
    </button>
  );
}

export function CalendarWeekView({
  weekDays,
  appointments,
  businessHours,
  timezone,
  slotIntervalMinutes,
  onSelectAppointment,
  onSelectSlot,
}: {
  weekDays: Date[];
  appointments: AppointmentWithRelations[];
  businessHours: BusinessHours[];
  timezone: string;
  slotIntervalMinutes: number;
  onSelectAppointment: (appointment: AppointmentWithRelations) => void;
  onSelectSlot: (day: Date, slotMinutes: number) => void;
}) {
  const calendarRows = useMemo(
    () => getCalendarRows(businessHours, slotIntervalMinutes),
    [businessHours, slotIntervalMinutes]
  );

  const { minMinutes } = useMemo(
    () => getCalendarTimeBounds(businessHours),
    [businessHours]
  );

  const todayKey = formatInBusinessTimezone(
    new Date().toISOString(),
    timezone,
    "yyyy-MM-dd"
  );

  const nowLine = useMemo(() => {
    const today = weekDays.find(
      (day) => format(day, "yyyy-MM-dd") === todayKey
    );
    if (!today) return null;

    const zonedNow = toZonedTime(new Date(), timezone);
    const zonedMinutes = zonedNow.getHours() * 60 + zonedNow.getMinutes();
    const gridEnd = minMinutes + calendarRows.length * slotIntervalMinutes;

    if (zonedMinutes < minMinutes || zonedMinutes >= gridEnd) return null;

    const rowIndex = Math.floor(
      (zonedMinutes - minMinutes) / slotIntervalMinutes
    );

    return { day: today, rowIndex };
  }, [weekDays, todayKey, timezone, minMinutes, calendarRows.length, slotIntervalMinutes]);

  return (
    <div
      className="calendar-week-view hidden md:flex md:flex-col h-[calc(100vh-14rem)] min-h-[520px] rounded-xl border border-border bg-card overflow-hidden shadow-sm"
      role="grid"
      aria-label="Weekly appointment calendar"
    >
      <div
        className="grid shrink-0 border-b border-border bg-muted/30"
        style={{ gridTemplateColumns: "72px repeat(7, minmax(0, 1fr))" }}
        role="row"
      >
        <div className="border-r border-border" role="columnheader" aria-hidden />
        {weekDays.map((day) => {
          const { weekday, date } = formatDayLabel(day);
          const isToday = format(day, "yyyy-MM-dd") === todayKey;

          return (
            <div
              key={day.toISOString()}
              role="columnheader"
              className={cn(
                "border-r border-border px-2 py-3 text-center last:border-r-0",
                isToday && "bg-accent/40"
              )}
            >
              <div className="text-xs font-medium text-muted-foreground">
                {weekday}
              </div>
              <div
                className={cn(
                  "mx-auto mt-1 flex size-8 items-center justify-center rounded-full text-sm font-semibold",
                  isToday && "bg-primary text-primary-foreground"
                )}
              >
                {date}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-auto">
        <div className="min-w-[880px]">
          {calendarRows.map((row, rowIndex) => (
            <div
              key={row.minutes}
              className="relative grid items-stretch border-b border-border last:border-b-0"
              style={{ gridTemplateColumns: "72px repeat(7, minmax(0, 1fr))" }}
              role="row"
            >
              <div className="border-r border-border bg-muted/20 px-2 py-2 text-[11px] leading-tight text-muted-foreground">
                {row.label}
              </div>

              {weekDays.map((day) => {
                const isToday = format(day, "yyyy-MM-dd") === todayKey;
                const open = isWithinBusinessHours(
                  day,
                  row.minutes,
                  businessHours
                );
                const slotAppointments = appointments.filter((apt) =>
                  appointmentInSlot(
                    apt.start_at,
                    day,
                    row.minutes,
                    slotIntervalMinutes,
                    timezone
                  )
                );
                const hasAppointments = slotAppointments.length > 0;
                const showNowLine =
                  nowLine &&
                  nowLine.rowIndex === rowIndex &&
                  format(day, "yyyy-MM-dd") === format(nowLine.day, "yyyy-MM-dd");

                return (
                  <div
                    key={`${day.toISOString()}-${row.minutes}`}
                    role="gridcell"
                    tabIndex={0}
                    onClick={() => onSelectSlot(day, row.minutes)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelectSlot(day, row.minutes);
                      }
                    }}
                    aria-label={`${format(day, "EEEE, MMMM d")}, ${row.label}`}
                    className={cn(
                      "relative border-r border-border px-1 py-1 last:border-r-0 cursor-pointer transition-colors hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset",
                      !open && "bg-muted/35",
                      isToday && open && "bg-accent/10",
                      !hasAppointments && (open ? "min-h-7" : "min-h-5")
                    )}
                  >
                    {showNowLine && (
                      <div
                        className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center"
                        aria-hidden
                      >
                        <span className="size-2 -translate-x-1 rounded-full bg-primary" />
                        <span className="h-px flex-1 bg-primary" />
                      </div>
                    )}

                    {hasAppointments ? (
                      <div className="flex flex-col gap-1">
                        {slotAppointments.map((apt) => (
                          <AppointmentCard
                            key={apt.id}
                            appointment={apt}
                            timezone={timezone}
                            onSelect={() => onSelectAppointment(apt)}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
