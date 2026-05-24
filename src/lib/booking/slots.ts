import { addMinutes, format, parseISO, startOfDay } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import type {
  Appointment,
  AvailabilityWindow,
  BusinessSettings,
} from "@/types/database";

export interface SlotInput {
  date: string;
  timezone: string;
  serviceDurationMinutes: number;
  settings: BusinessSettings;
  availability: AvailabilityWindow[];
  appointments: Pick<Appointment, "start_at" | "end_at" | "status">[];
  timeOff: { start_at: string; end_at: string }[];
}

function timeToMinutes(time: string): number {
  const [h, m] = time.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

export function intersectAvailability(
  businessHours: AvailabilityWindow[],
  staffHours: AvailabilityWindow[]
): AvailabilityWindow[] {
  if (staffHours.length === 0) return businessHours;
  if (businessHours.length === 0) return [];

  const result: AvailabilityWindow[] = [];

  for (let day = 0; day <= 6; day++) {
    const bizWindows = businessHours.filter((h) => h.day_of_week === day);
    const staffWindows = staffHours.filter((h) => h.day_of_week === day);

    for (const biz of bizWindows) {
      const bizStart = timeToMinutes(biz.start_time);
      const bizEnd = timeToMinutes(biz.end_time);

      for (const staff of staffWindows) {
        const staffStart = timeToMinutes(staff.start_time);
        const staffEnd = timeToMinutes(staff.end_time);
        const start = Math.max(bizStart, staffStart);
        const end = Math.min(bizEnd, staffEnd);

        if (start < end) {
          result.push({
            day_of_week: day,
            start_time: minutesToTime(start),
            end_time: minutesToTime(end),
          });
        }
      }
    }
  }

  return result;
}

function overlaps(
  start: Date,
  end: Date,
  blockedStart: Date,
  blockedEnd: Date
): boolean {
  return start < blockedEnd && end > blockedStart;
}

export type SlotOption = {
  startAt: string;
  available: boolean;
};

export function generateDaySlotOptions(input: SlotInput): SlotOption[] {
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

  const slots: SlotOption[] = [];

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

      slots.push({
        startAt: cursor.toISOString(),
        available:
          isPastMin && isWithinMax && !blockedByAppointment && !blockedByTimeOff,
      });

      cursor = addMinutes(cursor, interval);
    }
  }

  return slots;
}

export function generateSlots(input: SlotInput): string[] {
  return generateDaySlotOptions(input)
    .filter((slot) => slot.available)
    .map((slot) => slot.startAt);
}

export function slotBelongsToDate(
  iso: string,
  date: string,
  timezone: string
): boolean {
  const zoned = toZonedTime(parseISO(iso), timezone);
  return format(zoned, "yyyy-MM-dd") === date;
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

export function staffServiceSlotKey(staffId: string, serviceId: string): string {
  return `${staffId}:${serviceId}`;
}
