import { redirect } from "next/navigation";
import { getUserMembership } from "@/lib/business";
import { BrandLogo } from "@/components/brand/logo";
import { LogoutButton } from "@/components/auth/logout-button";

export default async function TeachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const membership = await getUserMembership();
  if (!membership) redirect("/login");
  if (membership.role !== "staff") redirect("/dashboard");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <BrandLogo size="sm" />
            <div>
              <p className="text-sm font-semibold">{membership.businesses.name}</p>
              <p className="text-xs text-muted-foreground">
                Teacher · {membership.display_name}
              </p>
            </div>
          </div>
          <LogoutButton />
        </div>
      </header>
      <main id="main-content" className="mx-auto max-w-3xl p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}
