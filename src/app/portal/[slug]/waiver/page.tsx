import { requireMemberClient, getActingClients } from "@/lib/member";
import { createClient } from "@/lib/supabase/server";
import { formatInTimeZone } from "date-fns-tz";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WaiverSignForm } from "@/components/portal/waiver-sign-form";

export default async function MemberWaiverPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const context = await requireMemberClient(slug);
  const acting = getActingClients(context);
  const supabase = await createClient();

  const { data: currentWaiver } = await supabase
    .from("waiver_versions")
    .select("*")
    .eq("business_id", context.business.id)
    .not("published_at", "is", null)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!currentWaiver) {
    return (
      <div className="space-y-6">
        <PageHeader title="Waiver" description={context.business.name} />
        <p className="text-sm text-muted-foreground">
          {context.business.name} hasn&apos;t published a waiver — nothing to
          sign.
        </p>
      </div>
    );
  }

  const { data: acceptances } = await supabase
    .from("waiver_acceptances")
    .select("client_id, accepted_at")
    .eq("waiver_version_id", currentWaiver.id)
    .in(
      "client_id",
      acting.map((c) => c.id)
    );

  const acceptedById = new Map(
    (acceptances ?? []).map((a) => [a.client_id, a.accepted_at])
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={currentWaiver.title}
        description={`${context.business.name} · version ${currentWaiver.version}`}
      />

      <Card>
        <CardContent className="pt-6">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {currentWaiver.body}
          </p>
        </CardContent>
      </Card>

      {acting.map((client) => {
        const acceptedAt = acceptedById.get(client.id);
        const isSelf = client.id === context.client.id;
        return (
          <Card key={client.id}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">
                {isSelf ? "You" : client.full_name}
              </CardTitle>
              {acceptedAt && (
                <Badge variant="success">
                  Signed{" "}
                  {formatInTimeZone(
                    acceptedAt,
                    context.business.timezone,
                    "d MMM yyyy"
                  )}
                </Badge>
              )}
            </CardHeader>
            {!acceptedAt && (
              <CardContent>
                <WaiverSignForm
                  slug={slug}
                  clientId={client.id}
                  signerLabel={
                    isSelf
                      ? "Type your full name to sign"
                      : `Sign as guardian for ${client.full_name}`
                  }
                />
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
