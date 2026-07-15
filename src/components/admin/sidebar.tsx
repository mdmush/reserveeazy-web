"use client";

import {
  LayoutDashboard,
  Building2,
  Users,
  Calendar,
  ArrowLeft,
} from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";
import {
  AppSidebar,
  AppMobileNav,
  type ShellNavItem,
} from "@/components/shell/app-sidebar";

const navItems: ShellNavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true, color: "primary" },
  { href: "/admin/businesses", label: "Businesses", icon: Building2, color: "blue" },
  { href: "/admin/users", label: "Users", icon: Users, color: "violet" },
  { href: "/admin/appointments", label: "Appointments", icon: Calendar, color: "teal" },
];

export function AdminSidebar({ hasDashboard }: { hasDashboard: boolean }) {
  return (
    <AppSidebar
      items={navItems}
      navLabel="Platform admin"
      brandHref="/admin"
      subtitle="Platform admin"
      subtitleClassName="text-primary"
      footerActions={
        hasDashboard ? (
          <LinkButton
            variant="outline"
            className="w-full justify-start"
            href="/dashboard"
          >
            <ArrowLeft className="h-4 w-4 mr-2" aria-hidden />
            Back to dashboard
          </LinkButton>
        ) : undefined
      }
    />
  );
}

export function AdminMobileNav({ hasDashboard }: { hasDashboard: boolean }) {
  return (
    <AppMobileNav
      items={navItems}
      navLabel="Platform admin"
      brandHref="/admin"
      subtitle="Platform admin"
      subtitleClassName="text-primary"
      footerActions={
        hasDashboard ? (
          <LinkButton
            variant="outline"
            size="sm"
            className="flex-1"
            href="/dashboard"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" aria-hidden />
            Dashboard
          </LinkButton>
        ) : undefined
      }
    />
  );
}
