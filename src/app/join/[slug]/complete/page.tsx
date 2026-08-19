import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/business";
import { getMemberContext } from "@/lib/member";
import { getCapabilities } from "@/lib/pricing-mode";
import type { Business } from "@/types/database";
import { AuthShell } from "@/components/brand/auth-shell";
import { CompleteProfileForm } from "@/components/portal/complete-profile-form";
import { Card, CardContent } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";

export default async function JoinCompletePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getCurrentUser();

  if (!user) {
    // Magic link expired or opened without a session — restart the join flow.
    return (
      <AuthShell title="Link expired">
        <Card className="w-full card-glow">
          <CardContent className="pt-6 space-y-4 text-sm text-muted-foreground">
            <p>
              Your join link has expired or was already used. Request a fresh
              one — it only takes a moment.
            </p>
            <LinkButton href={`/join/${slug}`} className="w-full">
              Get a new join link
            </LinkButton>
          </CardContent>
        </Card>
      </AuthShell>
    );
  }

  // Already a member here → straight to the portal.
  const existing = await getMemberContext(slug);
  if (existing) redirect(`/portal/${slug}`);

  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_booking_context", {
    p_slug: slug,
  });
  const business = (data as { business?: Business } | null)?.business;
  if (!business) notFound();
  if (!getCapabilities(business.pricing_mode).attendance) redirect(`/join/${slug}`);

  const prefillName =
    (user.user_metadata?.full_name as string | undefined) ?? "";

  return (
    <AuthShell
      title={`Almost there`}
      subtitle={`Confirm your details to join ${business.name}`}
    >
      <CompleteProfileForm slug={slug} initialName={prefillName} />
    </AuthShell>
  );
}
