import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCapabilities } from "@/lib/pricing-mode";
import type { Business } from "@/types/database";
import { AuthShell } from "@/components/brand/auth-shell";
import { JoinForm } from "@/components/portal/join-form";
import { Card, CardContent } from "@/components/ui/card";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  // Anonymous studio lookup goes through the public booking RPC (no anon
  // table reads exist); we only need the business envelope from it.
  const { data } = await supabase.rpc("get_public_booking_context", {
    p_slug: slug,
  });
  const business = (data as { business?: Business } | null)?.business;
  if (!business) notFound();

  const joinable = getCapabilities(business.pricing_mode).attendance;

  return (
    <AuthShell
      title={`Join ${business.name}`}
      subtitle={
        joinable
          ? "Book classes, track your credits, and manage your schedule"
          : undefined
      }
    >
      {joinable ? (
        <JoinForm slug={slug} studioName={business.name} />
      ) : (
        <Card className="w-full card-glow">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            {business.name}
            {" doesn't offer online membership yet — book directly on their booking page or contact the studio."}
          </CardContent>
        </Card>
      )}
    </AuthShell>
  );
}
