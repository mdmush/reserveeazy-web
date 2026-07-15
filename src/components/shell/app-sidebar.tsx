"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { logoutAction } from "@/actions/auth";

export const accents = {
  primary: { soft: "bg-secondary text-primary", solid: "bg-primary text-primary-foreground", ring: "ring-primary/20" },
  blue: { soft: "bg-blue-soft text-blue-foreground", solid: "bg-blue text-white", ring: "ring-blue/20" },
  coral: { soft: "bg-coral-soft text-coral-foreground", solid: "bg-coral text-white", ring: "ring-coral/20" },
  teal: { soft: "bg-teal-soft text-teal-foreground", solid: "bg-teal text-white", ring: "ring-teal/20" },
  violet: { soft: "bg-violet-soft text-violet-foreground", solid: "bg-violet text-white", ring: "ring-violet/20" },
  amber: { soft: "bg-amber-soft text-amber-foreground", solid: "bg-amber text-white", ring: "ring-amber/20" },
} as const;

export type Accent = keyof typeof accents;

export interface ShellNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  color: Accent;
}

interface ShellProps {
  items: ShellNavItem[];
  navLabel: string;
  brandHref: string;
  subtitle: string;
  subtitleClassName?: string;
  /** Extra buttons above the sign-out row (booking page, admin links, ...). */
  footerActions?: React.ReactNode;
}

function useIsActive() {
  const pathname = usePathname();
  return (item: ShellNavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

export function AppSidebar({
  items,
  navLabel,
  brandHref,
  subtitle,
  subtitleClassName,
  footerActions,
}: ShellProps) {
  const isActive = useIsActive();

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card">
      <div className="brand-gradient-subtle border-b border-border p-4">
        <BrandLogo size="sm" href={brandHref} />
        <p
          className={cn(
            "text-sm text-muted-foreground truncate mt-2 font-medium",
            subtitleClassName
          )}
        >
          {subtitle}
        </p>
      </div>

      <nav className="flex-1 space-y-1 p-3" aria-label={navLabel}>
        {items.map((item) => {
          const active = isActive(item);
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
                  active ? accent.solid : accent.soft
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
        {footerActions}
        <div className="flex items-center gap-2">
          <form action={logoutAction} className="flex-1">
            <Button
              variant="ghost"
              className="w-full justify-start text-muted-foreground min-h-11"
              type="submit"
            >
              <LogOut className="h-4 w-4 mr-2" aria-hidden />
              Sign out
            </Button>
          </form>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}

export function AppMobileNav({
  items,
  navLabel,
  brandHref,
  subtitle,
  subtitleClassName,
  footerActions,
}: ShellProps) {
  const isActive = useIsActive();

  return (
    <div className="md:hidden border-b border-border bg-card">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/60">
        <BrandLogo size="sm" href={brandHref} />
        <div className="flex items-center gap-1">
          <span
            className={cn(
              "text-xs text-muted-foreground truncate max-w-[140px]",
              subtitleClassName
            )}
          >
            {subtitle}
          </span>
          <ThemeToggle />
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto p-2" aria-label={navLabel}>
        {items.map((item) => {
          const active = isActive(item);
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
        {footerActions}
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
