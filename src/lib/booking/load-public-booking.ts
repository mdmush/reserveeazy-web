import { addDays, format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import {
  generateDaySlotOptions,
  intersectAvailability,
  staffServiceSlotKey,
  type SlotOption,
} from "@/lib/booking/slots";
import type {
  AppointmentStatus,
  Business,
  BusinessHours,
  BusinessMember,
  Service,
  StaffAvailability,
} from "@/types/database";

export type StaffWithRelations = BusinessMember & {
  staff_services: { service_id: string }[];
  staff_availability: StaffAvailability[];
};

type PublicAppointment = {
  staff_member_id: string;
  start_at: string;
  end_at: string;
  status: AppointmentStatus;
};

type PublicBookingContext = {
  business: Business;
  services: Service[];
  staff: StaffWithRelations[];
  business_hours: BusinessHours[];
  time_off: { staff_member_id: string; start_at: string; end_at: string }[];
  appointments: PublicAppointment[];
};

/**
 * All public booking data comes through the get_public_booking_context RPC
 * (SECURITY DEFINER): anonymous visitors have no direct table reads, and the
 * RPC returns busy windows without client PII and staff without emails.
 */
export async function loadPublicBookingBySlug(slug: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_public_booking_context", {
    p_slug: slug,
  });

  if (error || !data) return null;
  const context = data as unknown as PublicBookingContext;

  const bookableStaff = context.staff;
  const activeServices = context.services;
  const allAppointments = context.appointments;
  const hours = context.business_hours;
  const business = context.business;
  const maxDays = Math.min(business.settings.max_advance_days, 60);

  const slotOptionsByStaffService: Record<string, SlotOption[]> = {};
  const dateRange = Array.from({ length: maxDays }, (_, i) =>
    format(addDays(new Date(), i), "yyyy-MM-dd")
  );

  for (const member of bookableStaff) {
    const memberAppointments = allAppointments.filter(
      (a) => a.staff_member_id === member.id
    );
    const memberTimeOff = context.time_off.filter(
      (t) => t.staff_member_id === member.id
    );

    const effectiveAvailability = intersectAvailability(
      hours,
      member.staff_availability ?? []
    );

    for (const service of activeServices) {
      if (!member.staff_services?.some((ss) => ss.service_id === service.id)) {
        continue;
      }

      const allSlotOptions: SlotOption[] = [];

      for (const date of dateRange) {
        const daySlots = generateDaySlotOptions({
          date,
          timezone: business.timezone,
          serviceDurationMinutes: service.duration_minutes,
          settings: business.settings,
          availability: effectiveAvailability,
          appointments: memberAppointments,
          timeOff: memberTimeOff,
        });
        allSlotOptions.push(...daySlots);
      }

      slotOptionsByStaffService[staffServiceSlotKey(member.id, service.id)] =
        allSlotOptions.sort((a, b) => a.startAt.localeCompare(b.startAt));
    }
  }

  return {
    business,
    services: activeServices,
    staff: bookableStaff,
    slotOptionsByStaffService,
    appointments: allAppointments,
  };
}

export type EmbedWidgetContext = {
  widget_id: string;
  position: string;
  button_label: string;
  allowed_domains: string[];
  business_id: string;
  business_slug: string;
  business_name: string;
  timezone: string;
};

export async function loadEmbedWidgetContext(token: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_embed_widget_context", {
    p_token: token,
  });

  if (error || !data) return null;
  return data as unknown as EmbedWidgetContext;
}

export function isDomainAllowed(
  allowedDomains: string[],
  referer: string | null,
  origin: string | null
): boolean {
  if (!allowedDomains.length) return true;

  const host = extractHost(referer) ?? extractHost(origin);
  if (!host) return false;

  return allowedDomains.some((domain) => {
    const normalized = domain.toLowerCase().replace(/^www\./, "");
    const hostNormalized = host.toLowerCase().replace(/^www\./, "");
    return hostNormalized === normalized || hostNormalized.endsWith(`.${normalized}`);
  });
}

function extractHost(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}
