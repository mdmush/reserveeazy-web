import { addDays, format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import {
  generateDaySlotOptions,
  intersectAvailability,
  staffServiceSlotKey,
  type SlotOption,
} from "@/lib/booking/slots";
import type {
  Business,
  BusinessHours,
  BusinessMember,
  StaffAvailability,
} from "@/types/database";

export type StaffWithRelations = BusinessMember & {
  staff_services: { service_id: string }[];
  staff_availability: StaffAvailability[];
};

export async function loadPublicBookingByBusinessId(businessId: string) {
  const supabase = await createClient();

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .single();

  if (!business) return null;

  const [
    { data: services },
    { data: staff },
    { data: appointments },
    { data: businessHours },
  ] = await Promise.all([
    supabase
      .from("services")
      .select("*")
      .eq("business_id", business.id)
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("business_members")
      .select("*, staff_services(service_id), staff_availability(*)")
      .eq("business_id", business.id)
      .eq("is_bookable", true),
    supabase
      .from("appointments")
      .select("start_at, end_at, status, staff_member_id")
      .eq("business_id", business.id)
      .gte("start_at", new Date().toISOString())
      .neq("status", "cancelled"),
    supabase
      .from("business_hours")
      .select("*")
      .eq("business_id", business.id),
  ]);

  const bookableStaff = (staff ?? []) as unknown as StaffWithRelations[];
  const activeServices = services ?? [];
  const allAppointments = appointments ?? [];
  const hours = (businessHours ?? []) as BusinessHours[];
  const typedBusiness = business as Business;
  const maxDays = Math.min(typedBusiness.settings.max_advance_days, 60);

  const slotOptionsByStaffService: Record<string, SlotOption[]> = {};
  const dateRange = Array.from({ length: maxDays }, (_, i) =>
    format(addDays(new Date(), i), "yyyy-MM-dd")
  );

  for (const member of bookableStaff) {
    const memberAppointments = allAppointments.filter(
      (a) => a.staff_member_id === member.id
    );

    const { data: timeOff } = await supabase
      .from("staff_time_off")
      .select("start_at, end_at")
      .eq("staff_member_id", member.id)
      .gte("end_at", new Date().toISOString());

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
          timezone: typedBusiness.timezone,
          serviceDurationMinutes: service.duration_minutes,
          settings: typedBusiness.settings,
          availability: effectiveAvailability,
          appointments: memberAppointments,
          timeOff: timeOff ?? [],
        });
        allSlotOptions.push(...daySlots);
      }

      slotOptionsByStaffService[staffServiceSlotKey(member.id, service.id)] =
        allSlotOptions.sort((a, b) => a.startAt.localeCompare(b.startAt));
    }
  }

  return {
    business: typedBusiness,
    services: activeServices,
    staff: bookableStaff,
    slotOptionsByStaffService,
    appointments: allAppointments,
  };
}

export async function loadPublicBookingBySlug(slug: string) {
  const supabase = await createClient();
  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (!business) return null;
  return loadPublicBookingByBusinessId(business.id);
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
