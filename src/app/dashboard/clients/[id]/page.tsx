import { notFound } from "next/navigation";
import { getUserMembership } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { ClientDetail } from "@/components/dashboard/client-detail";
import type { Appointment } from "@/types/database";

type AppointmentWithRelations = Appointment & {
  services: { name: string } | null;
  business_members: { display_name: string } | null;
};

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const membership = await getUserMembership();
  if (!membership) return null;

  const supabase = await createClient();
  const [{ data: client }, { data: appointments }] = await Promise.all([
    supabase
      .from("clients")
      .select("*")
      .eq("id", id)
      .eq("business_id", membership.business_id)
      .single(),
    supabase
      .from("appointments")
      .select("*, services(name), business_members(display_name)")
      .eq("client_id", id)
      .order("start_at", { ascending: false }),
  ]);

  if (!client) notFound();

  return <ClientDetail client={client} appointments={(appointments ?? []) as unknown as AppointmentWithRelations[]} />;
}
