"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  Users,
  Scissors,
  UserCircle,
  Settings,
  ExternalLink,
  LogOut,
  LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { BrandLogo } from "@/components/brand/logo";
import { logoutAction } from "@/actions/auth";
import type { Business } from "@/types/database";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/calendar", label: "Calendar", icon: Calendar },
  { href: "/dashboard/services", label: "Services", icon: Scissors },
  { href: "/dashboard/staff", label: "Staff", icon: Users },
  { href: "/dashboard/clients", label: "Clients", icon: UserCircle },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function DashboardSidebar({ business }: { business: Business }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card">
      <div className="brand-gradient-subtle border-b border-border p-4">
        <BrandLogo size="sm" href="/dashboard" />
        <p className="text-sm text-muted-foreground truncate mt-2 font-medium">
          {business.name}
        </p>
      </div>

      <nav className="flex-1 space-y-1 p-3" aria-label="Dashboard">
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
        <LinkButton
          variant="outline"
          className="w-full justify-start border-primary/30 text-primary hover:bg-accent"
          href={`/book/${business.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open booking page in new tab"
        >
          <ExternalLink className="h-4 w-4 mr-2" aria-hidden />
          Booking page
          <span className="sr-only"> (opens in new tab)</span>
        </LinkButton>
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

export function MobileNav({ business }: { business: Business }) {
  const pathname = usePathname();

  return (
    <div className="md:hidden border-b border-border bg-card">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/60">
        <BrandLogo size="sm" href="/dashboard" />
        <span className="text-xs text-muted-foreground truncate max-w-[140px]">
          {business.name}
        </span>
      </div>
      <nav
        className="flex gap-1 overflow-x-auto p-2"
        aria-label="Dashboard"
      >
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
                "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2.5 min-h-11 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
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
      <div className="flex gap-2 border-t border-border/60 p-2">
        <LinkButton
          variant="outline"
          size="sm"
          className="flex-1 border-primary/30 text-primary"
          href={`/book/${business.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open booking page in new tab"
        >
          <ExternalLink className="h-4 w-4 mr-1.5" aria-hidden />
          Booking
        </LinkButton>
        <form action={logoutAction} className="flex-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground min-h-11"
            type="submit"
          >
            <LogOut className="h-4 w-4 mr-1.5" aria-hidden />
            Sign out
          </Button>
        </form>
      </div>
    </div>
  );
}
