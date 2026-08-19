import { requireMemberClient, getActingClients } from "@/lib/member";
import { createClient } from "@/lib/supabase/server";
import type {
  CreditTransaction,
  GracePass,
  PackageInstance,
  Payment,
} from "@/types/database";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  MembershipView,
  type MemberInstanceRow,
} from "@/components/portal/membership-view";

export default async function MemberMembershipPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const context = await requireMemberClient(slug);
  const acting = getActingClients(context);
  const actingIds = acting.map((c) => c.id);
  const supabase = await createClient();

  const [
    { data: instances },
    { data: balances },
    { data: transactions },
    { data: passes },
    { data: payments },
    { data: packages },
    { data: classTypes },
  ] = await Promise.all([
    supabase
      .from("package_instances")
      .select("*")
      .in("client_id", actingIds)
      .order("purchased_at", { ascending: false }),
    supabase.from("package_instance_balances").select("*").in("client_id", actingIds),
    supabase
      .from("credit_transactions")
      .select("*")
      .in("client_id", actingIds)
      .order("id", { ascending: false })
      .limit(100),
    supabase
      .from("grace_passes")
      .select("*")
      .in("client_id", actingIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("payments")
      .select("*")
      .in("client_id", actingIds)
      .order("receipt_no", { ascending: false }),
    supabase.from("packages").select("id, name").eq("business_id", context.business.id),
    supabase.from("class_types").select("id, name").eq("business_id", context.business.id),
  ]);

  const balanceByInstance = new Map(
    (balances ?? []).map((b) => [b.package_instance_id, b.balance])
  );
  const packageNames = new Map((packages ?? []).map((p) => [p.id, p.name]));
  const classTypeNames = new Map((classTypes ?? []).map((ct) => [ct.id, ct.name]));
  const clientNames = new Map(acting.map((c) => [c.id, c.full_name]));

  const instanceRows: MemberInstanceRow[] = (
    (instances ?? []) as PackageInstance[]
  ).map((instance) => ({
    ...instance,
    balance: balanceByInstance.get(instance.id) ?? 0,
    packageName: packageNames.get(instance.package_id) ?? "Package",
    classTypeName: instance.class_type_id
      ? (classTypeNames.get(instance.class_type_id) ?? null)
      : null,
    clientName: clientNames.get(instance.client_id) ?? "",
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Membership"
        description={`Your packages and history at ${context.business.name}`}
      />
      <MembershipView
        instances={instanceRows}
        transactions={(transactions ?? []) as CreditTransaction[]}
        passes={(passes ?? []) as GracePass[]}
        payments={(payments ?? []) as Payment[]}
        showClientNames={acting.length > 1}
        timezone={context.business.timezone}
      />
    </div>
  );
}
