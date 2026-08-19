import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/business";
import { getCapabilities } from "@/lib/pricing-mode";
import type { Business, Client } from "@/types/database";

export type LinkedClient = Client & { businesses: Business };

export type MemberContext = {
  client: Client;
  business: Business;
  capabilities: ReturnType<typeof getCapabilities>;
  dependents: Client[];
};

/** All client records linked to the signed-in user, across studios. */
export async function getLinkedClients(): Promise<LinkedClient[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select("*, businesses(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  return (data ?? []) as unknown as LinkedClient[];
}

/** The member's context at one studio, or null when not linked there. */
export async function getMemberContext(
  slug: string
): Promise<MemberContext | null> {
  const linked = await getLinkedClients();
  const match = linked.find((c) => c.businesses.slug === slug);
  if (!match) return null;

  const supabase = await createClient();
  const { data: dependents } = await supabase
    .from("clients")
    .select("*")
    .eq("guardian_client_id", match.id)
    .order("full_name");

  const { businesses: business, ...client } = match;
  return {
    client: client as Client,
    business,
    capabilities: getCapabilities(business.pricing_mode),
    dependents: (dependents ?? []) as Client[],
  };
}

export async function requireMemberClient(slug: string): Promise<MemberContext> {
  const context = await getMemberContext(slug);
  if (!context) redirect("/portal");
  return context;
}

/** Clients the signed-in member may act for: themself plus dependents. */
export function getActingClients(context: MemberContext): Client[] {
  return [context.client, ...context.dependents];
}
