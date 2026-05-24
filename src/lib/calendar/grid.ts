import { format, getDay, parseISO } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import type { AvailabilityWindow } from "@/types/database";

function timeToMinutes(time: string): number {
  const [h, m] = time.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

function formatMinutesLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const d = new Date(2000, 0, 1, h, m);
  return m === 0 ? format(d, "ha") : format(d, "h:mm a");
}

export type CalendarRow = { minutes: number; label: string };

export function getCalendarRows(
  businessHours: AvailabilityWindow[],
  slotIntervalMinutes: number,
): CalendarRow[] {
  const rows: CalendarRow[] = [];

  if (businessHours.length === 0) {
    const start = 8 * 60;
    const end = 20 * 60;
    for (let m = start; m < end; m += slotIntervalMinutes) {
      rows.push({ minutes: m, label: formatMinutesLabel(m) });
    }
    return rows;
  }

  const minStart = Math.min(
    ...businessHours.map((h) => timeToMinutes(h.start_time)),
  );
  const maxEnd = Math.max(
    ...businessHours.map((h) => timeToMinutes(h.end_time)),
  );

  for (let m = minStart; m < maxEnd; m += slotIntervalMinutes) {
    rows.push({ minutes: m, label: formatMinutesLabel(m) });
  }

  return rows;
}

export function formatInBusinessTimezone(
  iso: string,
  timezone: string,
  fmt: string,
): string {
  return format(toZonedTime(parseISO(iso), timezone), fmt);
}

export function isSameBusinessDay(
  iso: string,
  day: Date,
  timezone: string,
): boolean {
  const zoned = toZonedTime(parseISO(iso), timezone);
  return format(zoned, "yyyy-MM-dd") === format(day, "yyyy-MM-dd");
}

export function getAppointmentStartMinutes(
  iso: string,
  timezone: string,
): number {
  const zoned = toZonedTime(parseISO(iso), timezone);
  return zoned.getHours() * 60 + zoned.getMinutes();
}

export function appointmentInSlot(
  startAt: string,
  day: Date,
  slotMinutes: number,
  slotIntervalMinutes: number,
  timezone: string,
): boolean {
  if (!isSameBusinessDay(startAt, day, timezone)) return false;
  const aptMinutes = getAppointmentStartMinutes(startAt, timezone);
  return (
    aptMinutes >= slotMinutes && aptMinutes < slotMinutes + slotIntervalMinutes
  );
}

export function isWithinBusinessHours(
  day: Date,
  slotMinutes: number,
  businessHours: AvailabilityWindow[],
): boolean {
  if (businessHours.length === 0) return true;

  const dayOfWeek = getDay(day);
  const windows = businessHours.filter((h) => h.day_of_week === dayOfWeek);

  return windows.some((window) => {
    const start = timeToMinutes(window.start_time);
    const end = timeToMinutes(window.end_time);
    return slotMinutes >= start && slotMinutes < end;
  });
}

export function appointmentInWeek(
  startAt: string,
  weekDays: Date[],
  timezone: string,
): boolean {
  const aptDate = formatInBusinessTimezone(startAt, timezone, "yyyy-MM-dd");
  return weekDays.some((day) => format(day, "yyyy-MM-dd") === aptDate);
}

export function getCalendarTimeBounds(businessHours: AvailabilityWindow[]): {
  minMinutes: number;
  maxMinutes: number;
} {
  let minMinutes = 8 * 60;
  let maxMinutes = 20 * 60;

  if (businessHours.length > 0) {
    minMinutes = Math.min(
      ...businessHours.map((h) => timeToMinutes(h.start_time)),
    );
    maxMinutes = Math.max(
      ...businessHours.map((h) => timeToMinutes(h.end_time)),
    );
  }

  return { minMinutes, maxMinutes };
}

function minutesToTimeInput(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function slotToDatetimeLocalValue(
  day: Date,
  slotMinutes: number,
): string {
  return `${format(day, "yyyy-MM-dd")}T${minutesToTimeInput(slotMinutes)}`;
}

export function formatSlotSelectionLabel(
  day: Date,
  slotMinutes: number,
): string {
  const h = Math.floor(slotMinutes / 60);
  const m = slotMinutes % 60;
  const timeDate = new Date(2000, 0, 1, h, m);
  const timeLabel = format(timeDate, "h:mm a");
  return `${format(day, "EEE, MMM d")} · ${timeLabel}`;
}

export function getOpenSlotOptionsForDay(
  day: Date,
  businessHours: AvailabilityWindow[],
  slotIntervalMinutes: number,
): CalendarRow[] {
  return getCalendarRows(businessHours, slotIntervalMinutes).filter((row) =>
    isWithinBusinessHours(day, row.minutes, businessHours),
  );
}

export function dateStringToLocalDay(date: string): Date {
  return new Date(`${date}T12:00:00`);
}

export function getEventLayout(
  startAt: string,
  endAt: string,
  day: Date,
  timezone: string,
  gridStartMinutes: number,
  slotIntervalMinutes: number,
  slotHeightPx: number,
): { top: number; height: number } | null {
  if (!isSameBusinessDay(startAt, day, timezone)) return null;

  const startMin = getAppointmentStartMinutes(startAt, timezone);
  const endMin = getAppointmentStartMinutes(endAt, timezone);
  if (endMin <= startMin) return null;

  const top =
    ((startMin - gridStartMinutes) / slotIntervalMinutes) * slotHeightPx;
  const height = Math.max(
    ((endMin - startMin) / slotIntervalMinutes) * slotHeightPx - 2,
    slotHeightPx * 0.75,
  );

  return { top, height };
}
