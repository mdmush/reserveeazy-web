/**
 * Phase C product roadmap — prioritized post-MVP features.
 * Decision recorded: Email/SMS reminders first (highest day-one value for salons).
 */
export const PHASE_C_PRIORITY = {
  current: "email_sms_reminders",
  order: [
    {
      id: "email_sms_reminders",
      label: "Email & SMS reminders",
      stack: ["Resend", "Twilio"],
      rationale: "Reduces no-shows; immediate value for appointment businesses",
    },
    {
      id: "stripe_payments",
      label: "Stripe payments & deposits",
      stack: ["Stripe"],
      rationale: "Monetization and further no-show reduction",
    },
    {
      id: "reports_dashboard",
      label: "Reports & insights",
      stack: [],
      rationale: "Revenue, utilization, popular services",
    },
    {
      id: "embeddable_widget",
      label: "Embeddable booking widget",
      stack: [],
      rationale: "Let businesses embed booking on their own site",
    },
    {
      id: "staff_invites",
      label: "Staff email invites",
      stack: [],
      rationale: "Real user accounts for team members",
    },
    {
      id: "client_portal",
      label: "Client login portal",
      stack: [],
      rationale: "Clients view and manage their bookings",
    },
  ],
} as const;

export type PhaseCFeature = (typeof PHASE_C_PRIORITY.order)[number]["id"];
