export type MemberRole = "owner" | "admin" | "staff";
export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "no_show";
export type AppointmentSource = "dashboard" | "online_booking";
export type BusinessType =
  | "salon"
  | "spa"
  | "barber"
  | "nail_studio"
  | "clinic"
  | "pet_grooming"
  | "other";
export type WidgetPosition =
  | "bottom_right"
  | "bottom_left"
  | "bottom_center"
  | "top_right"
  | "top_left";
export type PricingMode = "simple" | "pay_per_class" | "credits";
export type PackageScope = "locked" | "flexible";
export type ExpiryTrigger = "first_attendance" | "purchase";
export type CreditTransactionKind =
  | "purchase_grant"
  | "deduction"
  | "refund"
  | "forfeit"
  | "pass_grant"
  | "pass_redemption"
  | "manual_adjustment";
export type PaymentMethod =
  | "cash"
  | "bank_transfer"
  | "tng"
  | "duitnow_qr"
  | "card"
  | "other";
export type BookingStatus =
  | "booked"
  | "waitlisted"
  | "offered"
  | "cancelled_early"
  | "cancelled_late"
  | "attended"
  | "no_show"
  | "pass_makeup";

export interface BusinessSettings {
  slot_interval_minutes: number;
  min_notice_hours: number;
  max_advance_days: number;
  auto_confirm: boolean;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string | null;
          is_superuser: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          email?: string | null;
          is_superuser?: boolean;
          created_at?: string;
        };
        Update: {
          full_name?: string | null;
          email?: string | null;
          is_superuser?: boolean;
        };
        Relationships: [];
      };
      businesses: {
        Row: {
          id: string;
          name: string;
          slug: string;
          business_type: BusinessType;
          timezone: string;
          settings: BusinessSettings;
          pricing_mode: PricingMode;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          business_type?: BusinessType;
          timezone?: string;
          settings?: BusinessSettings;
          pricing_mode?: PricingMode;
          created_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          business_type?: BusinessType;
          timezone?: string;
          settings?: BusinessSettings;
          pricing_mode?: PricingMode;
        };
        Relationships: [];
      };
      business_members: {
        Row: {
          id: string;
          business_id: string;
          user_id: string | null;
          display_name: string;
          email: string | null;
          role: MemberRole;
          is_bookable: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          user_id?: string | null;
          display_name: string;
          email?: string | null;
          role?: MemberRole;
          is_bookable?: boolean;
          created_at?: string;
        };
        Update: {
          display_name?: string;
          email?: string | null;
          role?: MemberRole;
          is_bookable?: boolean;
          user_id?: string | null;
        };
        Relationships: [];
      };
      services: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          description: string | null;
          duration_minutes: number;
          price_cents: number;
          is_active: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          description?: string | null;
          duration_minutes: number;
          price_cents?: number;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          duration_minutes?: number;
          price_cents?: number;
          is_active?: boolean;
          sort_order?: number;
        };
        Relationships: [];
      };
      staff_services: {
        Row: {
          staff_member_id: string;
          service_id: string;
        };
        Insert: {
          staff_member_id: string;
          service_id: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      business_hours: {
        Row: {
          id: string;
          business_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
        };
        Update: {
          day_of_week?: number;
          start_time?: string;
          end_time?: string;
        };
        Relationships: [];
      };
      staff_availability: {
        Row: {
          id: string;
          staff_member_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
        };
        Insert: {
          id?: string;
          staff_member_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
        };
        Update: {
          day_of_week?: number;
          start_time?: string;
          end_time?: string;
        };
        Relationships: [];
      };
      staff_time_off: {
        Row: {
          id: string;
          staff_member_id: string;
          start_at: string;
          end_at: string;
          reason: string | null;
        };
        Insert: {
          id?: string;
          staff_member_id: string;
          start_at: string;
          end_at: string;
          reason?: string | null;
        };
        Update: {
          start_at?: string;
          end_at?: string;
          reason?: string | null;
        };
        Relationships: [];
      };
      clients: {
        Row: {
          id: string;
          business_id: string;
          full_name: string;
          email: string | null;
          phone: string | null;
          notes: string | null;
          date_of_birth: string | null;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
          health_declaration: string | null;
          health_flags: Json;
          guardian_client_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          full_name: string;
          email?: string | null;
          phone?: string | null;
          notes?: string | null;
          date_of_birth?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          health_declaration?: string | null;
          health_flags?: Json;
          guardian_client_id?: string | null;
          created_at?: string;
        };
        Update: {
          full_name?: string;
          email?: string | null;
          phone?: string | null;
          notes?: string | null;
          date_of_birth?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          health_declaration?: string | null;
          health_flags?: Json;
          guardian_client_id?: string | null;
        };
        Relationships: [];
      };
      appointments: {
        Row: {
          id: string;
          business_id: string;
          client_id: string;
          staff_member_id: string;
          service_id: string;
          start_at: string;
          end_at: string;
          status: AppointmentStatus;
          notes: string | null;
          source: AppointmentSource;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          client_id: string;
          staff_member_id: string;
          service_id: string;
          start_at: string;
          end_at: string;
          status?: AppointmentStatus;
          notes?: string | null;
          source?: AppointmentSource;
          created_at?: string;
        };
        Update: {
          client_id?: string;
          staff_member_id?: string;
          service_id?: string;
          start_at?: string;
          end_at?: string;
          status?: AppointmentStatus;
          notes?: string | null;
        };
        Relationships: [];
      };
      class_types: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          description: string | null;
          color: string | null;
          default_duration_minutes: number;
          default_capacity: number;
          credit_cost: number;
          drop_in_price_cents: number;
          is_active: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          description?: string | null;
          color?: string | null;
          default_duration_minutes?: number;
          default_capacity?: number;
          credit_cost?: number;
          drop_in_price_cents?: number;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          color?: string | null;
          default_duration_minutes?: number;
          default_capacity?: number;
          credit_cost?: number;
          drop_in_price_cents?: number;
          is_active?: boolean;
          sort_order?: number;
        };
        Relationships: [];
      };
      class_sessions: {
        Row: {
          id: string;
          business_id: string;
          class_type_id: string;
          teacher_id: string;
          start_at: string;
          end_at: string;
          capacity: number;
          room: string | null;
          status: "scheduled" | "cancelled";
          recurrence_group_id: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          class_type_id: string;
          teacher_id: string;
          start_at: string;
          end_at: string;
          capacity: number;
          room?: string | null;
          status?: "scheduled" | "cancelled";
          recurrence_group_id?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          class_type_id?: string;
          teacher_id?: string;
          start_at?: string;
          end_at?: string;
          capacity?: number;
          room?: string | null;
          status?: "scheduled" | "cancelled";
          notes?: string | null;
        };
        Relationships: [];
      };
      packages: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          scope: PackageScope;
          class_type_id: string | null;
          credit_count: number;
          validity_days: number;
          expiry_trigger: ExpiryTrigger;
          price_cents: number;
          is_active: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          scope: PackageScope;
          class_type_id?: string | null;
          credit_count: number;
          validity_days: number;
          expiry_trigger?: ExpiryTrigger;
          price_cents: number;
          is_active?: boolean;
          sort_order?: number;
        };
        Update: {
          name?: string;
          scope?: PackageScope;
          class_type_id?: string | null;
          credit_count?: number;
          validity_days?: number;
          expiry_trigger?: ExpiryTrigger;
          price_cents?: number;
          is_active?: boolean;
          sort_order?: number;
        };
        Relationships: [];
      };
      package_instances: {
        Row: {
          id: string;
          business_id: string;
          package_id: string;
          client_id: string;
          scope: PackageScope;
          class_type_id: string | null;
          credit_count: number;
          validity_days: number;
          expiry_trigger: ExpiryTrigger;
          purchased_at: string;
          activated_at: string | null;
          expires_at: string | null;
          created_by: string | null;
        };
        Insert: Record<string, never>;
        Update: {
          activated_at?: string | null;
          expires_at?: string | null;
        };
        Relationships: [];
      };
      credit_transactions: {
        Row: {
          id: number;
          business_id: string;
          client_id: string;
          package_instance_id: string | null;
          booking_id: string | null;
          kind: CreditTransactionKind;
          amount: number;
          cost_snapshot: number | null;
          reason: string | null;
          actor_user_id: string | null;
          created_at: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      receipt_counters: {
        Row: {
          business_id: string;
          next_number: number;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          business_id: string;
          client_id: string;
          package_instance_id: string | null;
          payment_due_id: string | null;
          amount_cents: number;
          method: PaymentMethod;
          paid_at: string;
          receipt_no: number;
          receipt_number: string;
          notes: string | null;
          recorded_by: string | null;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      bookings: {
        Row: {
          id: string;
          business_id: string;
          class_session_id: string;
          client_id: string;
          status: BookingStatus;
          paid_by_package_instance_id: string | null;
          credit_cost_snapshot: number | null;
          grace_pass_id: string | null;
          waitlist_position: number | null;
          offered_at: string | null;
          offer_expires_at: string | null;
          booked_by: string | null;
          created_at: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      commission_rates: {
        Row: {
          id: string;
          business_id: string;
          teacher_id: string;
          class_type_id: string | null;
          rate_per_head_cents: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          teacher_id: string;
          class_type_id?: string | null;
          rate_per_head_cents: number;
        };
        Update: {
          rate_per_head_cents?: number;
        };
        Relationships: [];
      };
      commission_events: {
        Row: {
          id: number;
          business_id: string;
          booking_id: string;
          class_session_id: string;
          class_type_id: string;
          teacher_id: string;
          client_id: string;
          rate_snapshot_cents: number;
          occurred_at: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      payment_dues: {
        Row: {
          id: string;
          business_id: string;
          client_id: string;
          booking_id: string;
          class_session_id: string;
          amount_cents: number;
          status: "due" | "paid" | "waived";
          payment_id: string | null;
          waive_reason: string | null;
          created_at: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      waiver_versions: {
        Row: {
          id: string;
          business_id: string;
          version: number;
          title: string;
          body: string;
          published_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          version: number;
          title: string;
          body: string;
          published_at?: string | null;
        };
        Update: {
          title?: string;
          body?: string;
          published_at?: string | null;
        };
        Relationships: [];
      };
      waiver_acceptances: {
        Row: {
          id: string;
          business_id: string;
          client_id: string;
          waiver_version_id: string;
          accepted_at: string;
          accepted_by_client_id: string | null;
          signature_name: string;
          recorded_by: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      grace_passes: {
        Row: {
          id: string;
          business_id: string;
          client_id: string;
          source_booking_id: string | null;
          reason: string;
          status: "available" | "redeemed" | "revoked";
          redeemed_booking_id: string | null;
          granted_by: string | null;
          created_at: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      booking_widgets: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          public_token: string;
          position: WidgetPosition;
          button_label: string;
          allowed_domains: string[];
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          public_token: string;
          position?: WidgetPosition;
          button_label?: string;
          allowed_domains?: string[];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          public_token?: string;
          position?: WidgetPosition;
          button_label?: string;
          allowed_domains?: string[];
          is_active?: boolean;
        };
        Relationships: [];
      };
    };
    Views: {
      package_instance_balances: {
        Row: {
          package_instance_id: string;
          business_id: string;
          client_id: string;
          balance: number;
        };
        Relationships: [];
      };
    };
    Enums: {
      member_role: MemberRole;
      appointment_status: AppointmentStatus;
      appointment_source: AppointmentSource;
      business_type: BusinessType;
      widget_position: WidgetPosition;
    };
    CompositeTypes: Record<string, never>;
    Functions: {
      create_public_booking: {
        Args: {
          p_business_slug: string;
          p_service_id: string;
          p_staff_member_id: string;
          p_start_at: string;
          p_client_name: string;
          p_client_email?: string | null;
          p_client_phone?: string | null;
        };
        Returns: string;
      };
      get_embed_widget_context: {
        Args: {
          p_token: string;
        };
        Returns: Json;
      };
      get_public_booking_context: {
        Args: {
          p_slug: string;
        };
        Returns: Json;
      };
      create_business: {
        Args: {
          p_name: string;
          p_slug: string;
          p_business_type: BusinessType;
          p_timezone: string;
          p_owner_name: string;
        };
        Returns: string;
      };
      assign_package: {
        Args: {
          p_client_id: string;
          p_package_id: string;
          p_amount_cents: number;
          p_method: PaymentMethod;
          p_paid_at?: string;
          p_notes?: string | null;
        };
        Returns: Json;
      };
      adjust_credits: {
        Args: {
          p_package_instance_id: string;
          p_amount: number;
          p_reason: string;
        };
        Returns: undefined;
      };
      book_class: {
        Args: {
          p_class_session_id: string;
          p_client_id: string;
          p_package_instance_id?: string | null;
          p_grace_pass_id?: string | null;
          p_join_waitlist?: boolean;
        };
        Returns: Json;
      };
      cancel_booking: {
        Args: {
          p_booking_id: string;
          p_force_refund?: boolean;
        };
        Returns: Json;
      };
      mark_attendance: {
        Args: {
          p_booking_id: string;
          p_present: boolean;
        };
        Returns: Json;
      };
      revert_attendance: {
        Args: {
          p_booking_id: string;
          p_reason: string;
        };
        Returns: Json;
      };
      record_due_payment: {
        Args: {
          p_payment_due_id: string;
          p_method: PaymentMethod;
          p_amount_cents?: number | null;
        };
        Returns: Json;
      };
      waive_due: {
        Args: {
          p_payment_due_id: string;
          p_reason: string;
        };
        Returns: undefined;
      };
      offer_waitlist_spot: {
        Args: { p_booking_id: string };
        Returns: Json;
      };
      claim_waitlist_offer: {
        Args: {
          p_booking_id: string;
          p_package_instance_id?: string | null;
        };
        Returns: Json;
      };
      release_waitlist_offer: {
        Args: { p_booking_id: string };
        Returns: Json;
      };
      record_waiver_acceptance: {
        Args: {
          p_client_id: string;
          p_signature_name: string;
          p_accepted_by_client_id?: string | null;
        };
        Returns: string;
      };
      grant_grace_pass: {
        Args: {
          p_client_id: string;
          p_reason: string;
          p_source_booking_id?: string | null;
        };
        Returns: string;
      };
      revoke_grace_pass: {
        Args: {
          p_pass_id: string;
          p_reason: string;
        };
        Returns: undefined;
      };
    };
  };
}

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Business = Database["public"]["Tables"]["businesses"]["Row"];
export type BusinessMember =
  Database["public"]["Tables"]["business_members"]["Row"];
export type Service = Database["public"]["Tables"]["services"]["Row"];
export type Client = Database["public"]["Tables"]["clients"]["Row"];
export type Appointment = Database["public"]["Tables"]["appointments"]["Row"];
export type StaffAvailability =
  Database["public"]["Tables"]["staff_availability"]["Row"];
export type BusinessHours =
  Database["public"]["Tables"]["business_hours"]["Row"];
export type AvailabilityWindow = Pick<
  StaffAvailability,
  "day_of_week" | "start_time" | "end_time"
>;
export type BookingWidget =
  Database["public"]["Tables"]["booking_widgets"]["Row"];
export type ClassType = Database["public"]["Tables"]["class_types"]["Row"];
export type ClassSession =
  Database["public"]["Tables"]["class_sessions"]["Row"];
export type Package = Database["public"]["Tables"]["packages"]["Row"];
export type PackageInstance =
  Database["public"]["Tables"]["package_instances"]["Row"];
export type CreditTransaction =
  Database["public"]["Tables"]["credit_transactions"]["Row"];
export type Payment = Database["public"]["Tables"]["payments"]["Row"];
export type Booking = Database["public"]["Tables"]["bookings"]["Row"];
export type CommissionRate =
  Database["public"]["Tables"]["commission_rates"]["Row"];
export type CommissionEvent =
  Database["public"]["Tables"]["commission_events"]["Row"];
export type PaymentDue = Database["public"]["Tables"]["payment_dues"]["Row"];
export type GracePass = Database["public"]["Tables"]["grace_passes"]["Row"];
export type WaiverVersion =
  Database["public"]["Tables"]["waiver_versions"]["Row"];
export type WaiverAcceptance =
  Database["public"]["Tables"]["waiver_acceptances"]["Row"];
