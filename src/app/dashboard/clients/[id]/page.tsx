import { notFound } from "next/navigation";
import { getUserMembership } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { getCapabilities } from "@/lib/pricing-mode";
import { ClientDetail } from "@/components/dashboard/client-detail";
import {
  MemberPanel,
  type InstanceWithMeta,
} from "@/components/packages/member-panel";
import { formatInTimeZone } from "date-fns-tz";
import type {
  Appointment,
  CreditTransaction,
  GracePass,
  PackageInstance,
  Payment,
} from "@/types/database";

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

  const business = membership.businesses;
  const capabilities = getCapabilities(business.pricing_mode);
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
      .eq("business_id", membership.business_id)
      .order("start_at", { ascending: false }),
  ]);

  if (!client) notFound();

  let memberPanel: React.ReactNode = null;
  if (capabilities.attendance) {
    const [
      { data: instances },
      { data: balances },
      { data: transactions },
      { data: payments },
      { data: packages },
      { data: classTypes },
      { data: passes },
      { data: missed },
      { data: currentWaiver },
      { data: acceptances },
      { data: allClients },
    ] = await Promise.all([
      supabase
        .from("package_instances")
        .select("*, packages(name)")
        .eq("client_id", id)
        .eq("business_id", membership.business_id)
        .order("purchased_at", { ascending: false }),
      supabase
        .from("package_instance_balances")
        .select("*")
        .eq("client_id", id)
        .eq("business_id", membership.business_id),
      supabase
        .from("credit_transactions")
        .select("*")
        .eq("client_id", id)
        .eq("business_id", membership.business_id)
        .order("id", { ascending: false })
        .limit(100),
      supabase
        .from("payments")
        .select("*")
        .eq("client_id", id)
        .eq("business_id", membership.business_id)
        .order("receipt_no", { ascending: false }),
      supabase
        .from("packages")
        .select("*")
        .eq("business_id", membership.business_id)
        .order("sort_order"),
      supabase
        .from("class_types")
        .select("id, name")
        .eq("business_id", membership.business_id),
      supabase
        .from("grace_passes")
        .select("*")
        .eq("client_id", id)
        .eq("business_id", membership.business_id)
        .order("created_at", { ascending: false }),
      supabase
        .from("bookings")
        .select("id, status, class_sessions(start_at, class_types(name))")
        .eq("client_id", id)
        .eq("business_id", membership.business_id)
        .in("status", ["no_show", "cancelled_late"])
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("waiver_versions")
        .select("id, version")
        .eq("business_id", membership.business_id)
        .not("published_at", "is", null)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("waiver_acceptances")
        .select("waiver_version_id, accepted_at")
        .eq("client_id", id)
        .eq("business_id", membership.business_id),
      supabase
        .from("clients")
        .select("id, full_name, guardian_client_id")
        .eq("business_id", membership.business_id)
        .order("full_name"),
    ]);

    const balanceByInstance = new Map(
      (balances ?? []).map((b) => [b.package_instance_id, b.balance])
    );
    const classTypeNames = new Map(
      (classTypes ?? []).map((ct) => [ct.id, ct.name])
    );
    const instancesWithMeta: InstanceWithMeta[] = (
      (instances ?? []) as unknown as (PackageInstance & {
        packages: { name: string } | null;
      })[]
    ).map((instance) => ({
      ...instance,
      balance: balanceByInstance.get(instance.id) ?? 0,
      classTypeName: instance.class_type_id
        ? (classTypeNames.get(instance.class_type_id) ?? null)
        : null,
    }));

    type MissedRow = {
      id: string;
      status: string;
      class_sessions: {
        start_at: string;
        class_types: { name: string } | null;
      } | null;
    };
    const missedBookings = ((missed ?? []) as unknown as MissedRow[]).map(
      (row) => ({
        id: row.id,
        label: `${row.class_sessions?.class_types?.name ?? "Class"} · ${
          row.class_sessions
            ? formatInTimeZone(
                row.class_sessions.start_at,
                business.timezone,
                "d MMM"
              )
            : ""
        } (${row.status === "no_show" ? "no-show" : "late cancel"})`,
      })
    );

    const acceptance = currentWaiver
      ? (acceptances ?? []).find(
          (a) => a.waiver_version_id === currentWaiver.id
        )
      : undefined;
    const clientRows = allClients ?? [];
    const guardianName = client.guardian_client_id
      ? (clientRows.find((c) => c.id === client.guardian_client_id)
          ?.full_name ?? null)
      : null;

    memberPanel = (
      <MemberPanel
        clientId={id}
        clientName={client.full_name}
        instances={instancesWithMeta}
        transactions={(transactions ?? []) as CreditTransaction[]}
        payments={(payments ?? []) as Payment[]}
        packages={packages ?? []}
        passes={(passes ?? []) as GracePass[]}
        missedBookings={missedBookings}
        waiverStatus={{
          currentVersion: currentWaiver?.version ?? null,
          accepted: !!acceptance,
          acceptedAt: acceptance?.accepted_at ?? null,
        }}
        family={{
          guardianClientId: client.guardian_client_id,
          guardianName,
          dependents: clientRows.filter((c) => c.guardian_client_id === id),
          // One level only: dependents can't be guardians; exclude self.
          guardianOptions: clientRows.filter(
            (c) => c.id !== id && !c.guardian_client_id
          ),
        }}
        showCredits={capabilities.credits}
        timezone={business.timezone}
      />
    );
  }

  return (
    <div className="space-y-6">
      <ClientDetail
        client={client}
        appointments={
          (appointments ?? []) as unknown as AppointmentWithRelations[]
        }
      />
      {memberPanel}
    </div>
  );
}
