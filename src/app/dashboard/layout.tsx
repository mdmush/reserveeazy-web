import { redirect } from "next/navigation";
import { getUserMembership } from "@/lib/business";
import { getIsSuperuser } from "@/lib/superuser";
import { DashboardSidebar, MobileNav } from "@/components/dashboard/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const membership = await getUserMembership();

  if (!membership) {
    if (await getIsSuperuser()) {
      redirect("/admin");
    }
    redirect("/onboarding");
  }

  const business = membership.businesses;
  const isSuperuser = await getIsSuperuser();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <div className="hidden md:flex">
        <DashboardSidebar business={business} isSuperuser={isSuperuser} />
      </div>
      <MobileNav business={business} isSuperuser={isSuperuser} />
      <main id="main-content" className="flex-1 overflow-auto bg-background">
        <div className="mx-auto max-w-6xl p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
