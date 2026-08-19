import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { getLinkedClients } from "@/lib/member";
import { BrandLogo } from "@/components/brand/logo";
import { LogoutButton } from "@/components/auth/logout-button";
import { StudioPicker } from "@/components/portal/studio-picker";
import { EmptyState } from "@/components/dashboard/empty-states";

export default async function PortalIndexPage() {
  const linked = await getLinkedClients();

  if (linked.length === 1) {
    redirect(`/portal/${linked[0].businesses.slug}`);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between p-4">
          <BrandLogo size="sm" />
          <LogoutButton />
        </div>
      </header>
      <main id="main-content" className="mx-auto max-w-3xl p-4 md:p-8">
        {linked.length === 0 ? (
          <EmptyState
            icon={<Sparkles className="h-10 w-10" />}
            title="No studio memberships yet"
            description="Ask your studio for their join link to set up your membership here."
          />
        ) : (
          <StudioPicker
            studios={linked.map((c) => ({
              slug: c.businesses.slug,
              name: c.businesses.name,
              memberName: c.full_name,
            }))}
          />
        )}
      </main>
    </div>
  );
}
