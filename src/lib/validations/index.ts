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

export const availabilitySchema = z
  .object({
    dayOfWeek: z.number().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    endTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  })
  .refine(
    (data) => data.startTime.slice(0, 5) < data.endTime.slice(0, 5),
    { message: "End time must be after start time", path: ["endTime"] }
  );

export const businessHoursSchema = availabilitySchema;

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
  pricingMode: z.enum(["simple", "pay_per_class", "credits"]),
  slotIntervalMinutes: z.number().min(5).max(60),
  minNoticeHours: z.number().min(0),
  maxAdvanceDays: z.number().min(1),
  autoConfirm: z.boolean(),
});

export const classTypeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  color: z.string().optional(),
  defaultDurationMinutes: z.number().min(5, "Minimum 5 minutes"),
  defaultCapacity: z.number().min(1, "Capacity must be at least 1"),
  creditCost: z.number().min(1, "Credit cost must be at least 1"),
  dropInPriceCents: z.number().min(0),
  isActive: z.boolean(),
});

export const classSessionSchema = z
  .object({
    classTypeId: z.string().uuid(),
    teacherId: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Pick a start time"),
    durationMinutes: z.number().min(5, "Minimum 5 minutes"),
    capacity: z.number().min(1, "Capacity must be at least 1"),
    room: z.string().optional(),
    notes: z.string().optional(),
    repeatWeekly: z.boolean(),
    repeatUntil: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .or(z.literal("")),
  })
  .refine((data) => !data.repeatWeekly || !!data.repeatUntil, {
    message: "Pick an end date for the weekly repeat",
    path: ["repeatUntil"],
  })
  .refine(
    (data) =>
      !data.repeatWeekly || !data.repeatUntil || data.repeatUntil > data.date,
    { message: "End date must be after the first session", path: ["repeatUntil"] }
  );

export const magicLinkSchema = z.object({
  email: z.string().email("Enter a valid email"),
});

export const joinRequestSchema = z.object({
  fullName: z.string().min(2, "Your name is required"),
  email: z.string().email("Enter a valid email"),
});

export const completeProfileSchema = z.object({
  fullName: z.string().min(2, "Your name is required"),
  phone: z.string().optional(),
});

export const packageSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    scope: z.enum(["locked", "flexible"]),
    classTypeId: z.string().uuid().optional().or(z.literal("")),
    creditCount: z.number().min(1, "At least 1 credit"),
    validityDays: z.number().min(1, "At least 1 day"),
    expiryTrigger: z.enum(["first_attendance", "purchase"]),
    priceCents: z.number().min(0),
    isActive: z.boolean(),
  })
  .refine((data) => data.scope !== "locked" || !!data.classTypeId, {
    message: "Locked packages need a class type",
    path: ["classTypeId"],
  });

export const assignPackageSchema = z.object({
  clientId: z.string().uuid(),
  packageId: z.string().uuid(),
  amountCents: z.number().min(1, "Payment amount is required"),
  method: z.enum(["cash", "bank_transfer", "tng", "duitnow_qr", "card", "other"]),
  notes: z.string().optional(),
});

export const adjustCreditsSchema = z.object({
  packageInstanceId: z.string().uuid(),
  amount: z
    .number()
    .int()
    .refine((v) => v !== 0, "Amount cannot be zero"),
  reason: z.string().min(3, "A reason is required"),
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
export type BusinessHoursInput = z.infer<typeof businessHoursSchema>;
export type ClassTypeInput = z.infer<typeof classTypeSchema>;
export type ClassSessionInput = z.infer<typeof classSessionSchema>;
export type PackageInput = z.infer<typeof packageSchema>;
export type AssignPackageInput = z.infer<typeof assignPackageSchema>;
export type AdjustCreditsInput = z.infer<typeof adjustCreditsSchema>;
export type MagicLinkInput = z.infer<typeof magicLinkSchema>;
export type JoinRequestInput = z.infer<typeof joinRequestSchema>;
export type CompleteProfileInput = z.infer<typeof completeProfileSchema>;
