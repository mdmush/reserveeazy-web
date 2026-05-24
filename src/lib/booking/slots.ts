import { addMinutes, format, parseISO, startOfDay } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import type {
  Appointment,
  BusinessSettings,
  StaffAvailability,
} from "@/types/database";

export interface SlotInput {
  date: string;
  timezone: string;
  serviceDurationMinutes: number;
  settings: BusinessSettings;
  availability: StaffAvailability[];
  appointments: Pick<Appointment, "start_at" | "end_at" | "status">[];
  timeOff: { start_at: string; end_at: string }[];
}

function overlaps(
  start: Date,
  end: Date,
  blockedStart: Date,
  blockedEnd: Date
): boolean {
  return start < blockedEnd && end > blockedStart;
}

export function generateSlots(input: SlotInput): string[] {
  const {
    date,
    timezone,
    serviceDurationMinutes,
    settings,
    availability,
    appointments,
    timeOff,
  } = input;

  const interval = settings.slot_interval_minutes;
  const dayStart = fromZonedTime(`${date}T00:00:00`, timezone);
  const dayOfWeek = toZonedTime(dayStart, timezone).getDay();

  const dayAvailability = availability.filter((a) => a.day_of_week === dayOfWeek);
  if (dayAvailability.length === 0) return [];

  const now = new Date();
  const minNotice = addMinutes(now, settings.min_notice_hours * 60);
  const maxAdvance = addMinutes(now, settings.max_advance_days * 24 * 60);

  const slots: string[] = [];

  for (const window of dayAvailability) {
    const windowStart = fromZonedTime(`${date}T${window.start_time}`, timezone);
    const windowEnd = fromZonedTime(`${date}T${window.end_time}`, timezone);

    let cursor = windowStart;
    while (cursor < windowEnd) {
      const slotEnd = addMinutes(cursor, serviceDurationMinutes);
      if (slotEnd > windowEnd) break;

      const isPastMin = cursor >= minNotice;
      const isWithinMax = cursor <= maxAdvance;

      const blockedByAppointment = appointments.some((apt) => {
        if (apt.status === "cancelled") return false;
        return overlaps(
          cursor,
          slotEnd,
          parseISO(apt.start_at),
          parseISO(apt.end_at)
        );
      });

      const blockedByTimeOff = timeOff.some((off) =>
        overlaps(
          cursor,
          slotEnd,
          parseISO(off.start_at),
          parseISO(off.end_at)
        )
      );

      if (isPastMin && isWithinMax && !blockedByAppointment && !blockedByTimeOff) {
        slots.push(cursor.toISOString());
      }

      cursor = addMinutes(cursor, interval);
    }
  }

  return slots;
}

export function formatSlot(iso: string, timezone: string): string {
  const zoned = toZonedTime(parseISO(iso), timezone);
  return format(zoned, "h:mm a");
}

export function formatSlotDate(iso: string, timezone: string): string {
  const zoned = toZonedTime(parseISO(iso), timezone);
  return format(zoned, "EEEE, MMMM d, yyyy");
}

export function getWeekDates(anchor: Date): Date[] {
  const start = startOfDay(anchor);
  const day = start.getDay();
  const sunday = new Date(start);
  sunday.setDate(start.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return d;
  });
}
