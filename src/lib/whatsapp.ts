import { formatInTimeZone } from "date-fns-tz";

/**
 * v1 notifications are admin-tap wa.me links (spec §8): every event surfaces a
 * pre-filled WhatsApp message in the admin UI; the admin taps to send. Zero
 * API cost, clean upgrade path to WhatsApp Cloud API automation in Phase 2.
 */

/** Normalize a Malaysian-first phone number for wa.me (digits only). */
export function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, "");
  if (!digits) return null;
  if (digits.startsWith("+")) return digits.slice(1);
  if (digits.startsWith("0")) return `6${digits}`; // 012… → 6012…
  return digits;
}

export function waLink(phone: string | null, message: string): string | null {
  if (!phone) return null;
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

function when(iso: string, timezone: string): string {
  return formatInTimeZone(iso, timezone, "EEE d MMM, h:mm a");
}

type SessionInfo = {
  className: string;
  startAt: string;
  timezone: string;
  studioName: string;
};

export const waTemplates = {
  bookingConfirmation: (name: string, s: SessionInfo) =>
    `Hi ${name}! Your spot in ${s.className} on ${when(s.startAt, s.timezone)} is confirmed. See you at ${s.studioName}!`,

  cancellationConfirmation: (
    name: string,
    s: SessionInfo,
    creditRestored: boolean
  ) =>
    `Hi ${name}, your booking for ${s.className} on ${when(s.startAt, s.timezone)} has been cancelled. ` +
    (creditRestored
      ? "Your credit has been returned to your package."
      : "As this was within the cancellation window, the credit was used."),

  classReminder: (name: string, s: SessionInfo) =>
    `Hi ${name}! Reminder: ${s.className} tomorrow at ${formatInTimeZone(s.startAt, s.timezone, "h:mm a")} at ${s.studioName}. See you there!`,

  waitlistOffer: (name: string, s: SessionInfo, expiresAt: string) =>
    `Hi ${name}! A spot opened up in ${s.className} on ${when(s.startAt, s.timezone)}. Reply YES within the next ${formatInTimeZone(expiresAt, s.timezone, "h:mm a")} (claim window) to take it — first come, first served.`,

  packageExpiryWarning: (
    name: string,
    packageName: string,
    expiresAt: string,
    timezone: string,
    credits: number
  ) =>
    `Hi ${name}, your ${packageName} (${credits} credits left) expires on ${formatInTimeZone(expiresAt, timezone, "d MMM yyyy")}. Book your classes before then so nothing goes to waste!`,

  packageActivated: (
    name: string,
    packageName: string,
    expiresAt: string,
    timezone: string
  ) =>
    `Hi ${name}! Your ${packageName} is now active. It's valid until ${formatInTimeZone(expiresAt, timezone, "d MMM yyyy")}.`,

  passGranted: (name: string, studioName: string) =>
    `Hi ${name}! ${studioName} has granted you a make-up pass for your missed class. You can use it to join a class of a different type — just let us know which one.`,
};
