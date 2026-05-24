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
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          business_type?: BusinessType;
          timezone?: string;
          settings?: BusinessSettings;
          created_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          business_type?: BusinessType;
          timezone?: string;
          settings?: BusinessSettings;
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
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          full_name: string;
          email?: string | null;
          phone?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          full_name?: string;
          email?: string | null;
          phone?: string | null;
          notes?: string | null;
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
    Views: Record<string, never>;
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
