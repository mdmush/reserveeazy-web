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
  Shield,
  Code,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { BrandLogo } from "@/components/brand/logo";
import { logoutAction } from "@/actions/auth";
import type { Business } from "@/types/database";

const accents = {
  primary: { soft: "bg-secondary text-primary", solid: "bg-primary text-primary-foreground", ring: "ring-primary/20" },
  blue: { soft: "bg-blue-soft text-blue-foreground", solid: "bg-blue text-white", ring: "ring-blue/20" },
  coral: { soft: "bg-coral-soft text-coral-foreground", solid: "bg-coral text-white", ring: "ring-coral/20" },
  teal: { soft: "bg-teal-soft text-teal-foreground", solid: "bg-teal text-white", ring: "ring-teal/20" },
  violet: { soft: "bg-violet-soft text-violet-foreground", solid: "bg-violet text-white", ring: "ring-violet/20" },
  amber: { soft: "bg-amber-soft text-amber-foreground", solid: "bg-amber text-white", ring: "ring-amber/20" },
} as const;

type Accent = keyof typeof accents;

const navItems: {
  href: string;
  label: string;
  icon: typeof Calendar;
  exact?: boolean;
  color: Accent;
}[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true, color: "primary" },
  { href: "/dashboard/calendar", label: "Calendar", icon: Calendar, color: "blue" },
  { href: "/dashboard/services", label: "Services", icon: Scissors, color: "coral" },
  { href: "/dashboard/staff", label: "Staff", icon: Users, color: "teal" },
  { href: "/dashboard/clients", label: "Clients", icon: UserCircle, color: "violet" },
  { href: "/dashboard/widgets", label: "Widgets", icon: Code, color: "amber" },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, color: "primary" },
];

export function DashboardSidebar({
  business,
  isSuperuser = false,
}: {
  business: Business;
  isSuperuser?: boolean;
}) {
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
          const accent = accents[item.color];
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-2.5 py-2 min-h-11 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                active
                  ? cn(accent.soft, "ring-1", accent.ring)
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
                  active ? accent.solid : cn(accent.soft, "group-hover:opacity-100")
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3 space-y-2">
        {isSuperuser && (
          <LinkButton
            variant="outline"
            className="w-full justify-start border-primary/30 text-primary hover:bg-accent"
            href="/admin"
          >
            <Shield className="h-4 w-4 mr-2" aria-hidden />
            Platform admin
          </LinkButton>
        )}
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

export function MobileNav({
  business,
  isSuperuser = false,
}: {
  business: Business;
  isSuperuser?: boolean;
}) {
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
          const accent = accents[item.color];
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2.5 min-h-11 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                active
                  ? cn(accent.soft, "ring-1", accent.ring)
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="flex gap-2 border-t border-border/60 p-2">
        {isSuperuser && (
          <LinkButton
            variant="outline"
            size="sm"
            className="flex-1 border-primary/30 text-primary"
            href="/admin"
          >
            <Shield className="h-4 w-4 mr-1.5" aria-hidden />
            Admin
          </LinkButton>
        )}
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
