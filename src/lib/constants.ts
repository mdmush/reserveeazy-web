import type { BusinessType } from "@/types/database";

export const BUSINESS_TYPES: { value: BusinessType; label: string }[] = [
  { value: "salon", label: "Salon" },
  { value: "spa", label: "Spa" },
  { value: "barber", label: "Barber shop" },
  { value: "nail_studio", label: "Nail studio" },
  { value: "clinic", label: "Clinic" },
  { value: "pet_grooming", label: "Pet grooming" },
  { value: "other", label: "Other" },
];

export const TIMEZONES = [
  "UTC",
  "Europe/London",
  "Europe/Amsterdam",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Asia/Dubai",
  "Asia/Dhaka",
  "Asia/Singapore",
  "Australia/Sydney",
];

export const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  completed: "Completed",
  no_show: "No show",
};

export const DEFAULT_BUSINESS_SETTINGS = {
  slot_interval_minutes: 15,
  min_notice_hours: 2,
  max_advance_days: 60,
  auto_confirm: true,
};
