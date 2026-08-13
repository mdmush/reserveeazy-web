import type { PricingMode } from "@/types/database";

interface PricingModeInfo {
  label: string;
  description: string;
  /** Modes that are selectable today; the rest render disabled in settings. */
  available: boolean;
}

export const PRICING_MODES: Record<PricingMode, PricingModeInfo> = {
  simple: {
    label: "Simple booking",
    description: "Slot booking with email + phone. No member accounts or credits.",
    available: true,
  },
  pay_per_class: {
    label: "Pay per class",
    description: "Attendance tracking, instructor commission, payment-due lines.",
    available: false,
  },
  credits: {
    label: "Credit packages",
    description: "Prepaid class credits with locked and flexible scopes.",
    available: false,
  },
};

/**
 * Feature gates per mode. UI and reports must check capabilities, never the
 * mode value itself, so future modes slot in without scattered conditionals.
 */
export const PRICING_MODE_CAPABILITIES: Record<
  PricingMode,
  { attendance: boolean; credits: boolean; commission: boolean }
> = {
  simple: { attendance: false, credits: false, commission: false },
  pay_per_class: { attendance: true, credits: false, commission: true },
  credits: { attendance: true, credits: true, commission: true },
};
