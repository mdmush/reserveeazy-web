import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const signupSchema = z.object({
  fullName: z.string().min(2, "Name is required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const onboardingSchema = z.object({
  name: z.string().min(2, "Business name is required"),
  slug: z
    .string()
    .min(2, "Slug is required")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens"),
  businessType: z.enum([
    "salon",
    "spa",
    "barber",
    "nail_studio",
    "clinic",
    "pet_grooming",
    "other",
  ]),
  timezone: z.string().min(1, "Timezone is required"),
});

export const serviceSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  durationMinutes: z.number().min(5, "Minimum 5 minutes"),
  priceCents: z.number().min(0),
  isActive: z.boolean(),
});

export const staffSchema = z.object({
  displayName: z.string().min(1, "Name is required"),
  email: z.string().email().optional().or(z.literal("")),
  role: z.enum(["admin", "staff"]),
  isBookable: z.boolean(),
  serviceIds: z.array(z.string()),
});

export const availabilitySchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  endTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
});

export const clientSchema = z.object({
  fullName: z.string().min(1, "Name is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

export const appointmentSchema = z.object({
  clientId: z.string().uuid(),
  staffMemberId: z.string().uuid(),
  serviceId: z.string().uuid(),
  startAt: z.string(),
  notes: z.string().optional(),
});

export const settingsSchema = z.object({
  name: z.string().min(2),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  businessType: z.enum([
    "salon",
    "spa",
    "barber",
    "nail_studio",
    "clinic",
    "pet_grooming",
    "other",
  ]),
  timezone: z.string(),
  slotIntervalMinutes: z.number().min(5).max(60),
  minNoticeHours: z.number().min(0),
  maxAdvanceDays: z.number().min(1),
  autoConfirm: z.boolean(),
});

export const bookingClientSchema = z.object({
  fullName: z.string().min(2, "Name is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
});

export const widgetSchema = z.object({
  name: z.string().min(1, "Name is required"),
  position: z.enum([
    "bottom_right",
    "bottom_left",
    "bottom_center",
    "top_right",
    "top_left",
  ]),
  buttonLabel: z.string().min(1, "Button label is required"),
  allowedDomains: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type ServiceInput = z.infer<typeof serviceSchema>;
export type StaffInput = z.infer<typeof staffSchema>;
export type ClientInput = z.infer<typeof clientSchema>;
export type AppointmentInput = z.infer<typeof appointmentSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;
export type BookingClientInput = z.infer<typeof bookingClientSchema>;
export type WidgetInput = z.infer<typeof widgetSchema>;
