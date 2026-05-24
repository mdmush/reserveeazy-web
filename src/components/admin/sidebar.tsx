"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  Calendar,
  LogOut,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { BrandLogo } from "@/components/brand/logo";
import { logoutAction } from "@/actions/auth";

const navItems = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/businesses", label: "Businesses", icon: Building2 },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/appointments", label: "Appointments", icon: Calendar },
];

export function AdminSidebar({ hasDashboard }: { hasDashboard: boolean }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card">
      <div className="brand-gradient-subtle border-b border-border p-4">
        <BrandLogo size="sm" href="/admin" />
        <p className="text-sm font-medium text-primary mt-2">Platform admin</p>
      </div>

      <nav className="flex-1 space-y-1 p-3" aria-label="Platform admin">
        {navItems.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 min-h-11 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                active
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3 space-y-2">
        {hasDashboard && (
          <LinkButton
            variant="outline"
            className="w-full justify-start"
            href="/dashboard"
          >
            <ArrowLeft className="h-4 w-4 mr-2" aria-hidden />
            Back to dashboard
          </LinkButton>
        )}
        <form action={logoutAction}>
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground min-h-11"
            type="submit"
          >
            <LogOut className="h-4 w-4 mr-2" aria-hidden />
            Sign out
          </Button>
        </form>
      </div>
    </aside>
  );
}

export function AdminMobileNav({ hasDashboard }: { hasDashboard: boolean }) {
  const pathname = usePathname();

  return (
    <div className="md:hidden border-b border-border bg-card">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/60">
        <BrandLogo size="sm" href="/admin" />
        <span className="text-xs font-medium text-primary">Platform admin</span>
      </div>
      <nav className="flex gap-1 overflow-x-auto p-2" aria-label="Platform admin">
        {navItems.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2.5 min-h-11 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent"
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
      {hasDashboard && (
        <div className="border-t border-border/60 p-2">
          <LinkButton variant="outline" size="sm" className="w-full" href="/dashboard">
            <ArrowLeft className="h-4 w-4 mr-1.5" aria-hidden />
            Dashboard
          </LinkButton>
        </div>
      )}
    </div>
  );
}
