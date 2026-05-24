import { getUserMembership } from "@/lib/business";
import { requireSuperuser } from "@/lib/superuser";
import { AdminSidebar, AdminMobileNav } from "@/components/admin/sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSuperuser();
  const membership = await getUserMembership();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <div className="hidden md:flex">
        <AdminSidebar hasDashboard={!!membership} />
      </div>
      <AdminMobileNav hasDashboard={!!membership} />
      <main id="main-content" className="flex-1 overflow-auto bg-background">
        <div className="mx-auto max-w-6xl p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
