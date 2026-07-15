"use client";

import {
  Calendar,
  Users,
  Scissors,
  UserCircle,
  Settings,
  ExternalLink,
  LayoutDashboard,
  Shield,
  Code,
} from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";
import {
  AppSidebar,
  AppMobileNav,
  type ShellNavItem,
} from "@/components/shell/app-sidebar";
import type { Business } from "@/types/database";

const navItems: ShellNavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true, color: "primary" },
  { href: "/dashboard/calendar", label: "Calendar", icon: Calendar, color: "blue" },
  { href: "/dashboard/services", label: "Services", icon: Scissors, color: "coral" },
  { href: "/dashboard/staff", label: "Staff", icon: Users, color: "teal" },
  { href: "/dashboard/clients", label: "Clients", icon: UserCircle, color: "violet" },
  { href: "/dashboard/widgets", label: "Widgets", icon: Code, color: "amber" },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, color: "primary" },
];

function FooterActions({
  business,
  isSuperuser,
  compact = false,
}: {
  business: Business;
  isSuperuser: boolean;
  compact?: boolean;
}) {
  return (
    <>
      {isSuperuser && (
        <LinkButton
          variant="outline"
          size={compact ? "sm" : "default"}
          className={
            compact
              ? "flex-1 border-primary/30 text-primary"
              : "w-full justify-start border-primary/30 text-primary hover:bg-accent"
          }
          href="/admin"
        >
          <Shield
            className={compact ? "h-4 w-4 mr-1.5" : "h-4 w-4 mr-2"}
            aria-hidden
          />
          {compact ? "Admin" : "Platform admin"}
        </LinkButton>
      )}
      <LinkButton
        variant="outline"
        size={compact ? "sm" : "default"}
        className={
          compact
            ? "flex-1 border-primary/30 text-primary"
            : "w-full justify-start border-primary/30 text-primary hover:bg-accent"
        }
        href={`/book/${business.slug}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open booking page in new tab"
      >
        <ExternalLink
          className={compact ? "h-4 w-4 mr-1.5" : "h-4 w-4 mr-2"}
          aria-hidden
        />
        {compact ? "Booking" : "Booking page"}
        {!compact && <span className="sr-only"> (opens in new tab)</span>}
      </LinkButton>
    </>
  );
}

export function DashboardSidebar({
  business,
  isSuperuser = false,
}: {
  business: Business;
  isSuperuser?: boolean;
}) {
  return (
    <AppSidebar
      items={navItems}
      navLabel="Dashboard"
      brandHref="/dashboard"
      subtitle={business.name}
      footerActions={
        <FooterActions business={business} isSuperuser={isSuperuser} />
      }
    />
  );
}

export function MobileNav({
  business,
  isSuperuser = false,
}: {
  business: Business;
  isSuperuser?: boolean;
}) {
  return (
    <AppMobileNav
      items={navItems}
      navLabel="Dashboard"
      brandHref="/dashboard"
      subtitle={business.name}
      footerActions={
        <FooterActions business={business} isSuperuser={isSuperuser} compact />
      }
    />
  );
}
