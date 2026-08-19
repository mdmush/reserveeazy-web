import { getLinkedClients, requireMemberClient } from "@/lib/member";
import { PortalShell } from "@/components/portal/portal-shell";

export default async function PortalSlugLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}) {
  const { slug } = await params;
  const context = await requireMemberClient(slug);
  const linked = await getLinkedClients();

  return (
    <PortalShell
      slug={slug}
      studioName={context.business.name}
      studios={linked.map((c) => ({
        slug: c.businesses.slug,
        name: c.businesses.name,
      }))}
    >
      {children}
    </PortalShell>
  );
}
