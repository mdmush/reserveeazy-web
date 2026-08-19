"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand/logo";
import { LogoutButton } from "@/components/auth/logout-button";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TABS = [
  { segment: "", label: "Home" },
  { segment: "schedule", label: "Schedule" },
  { segment: "bookings", label: "My bookings" },
  { segment: "membership", label: "Membership" },
];

export function PortalShell({
  slug,
  studioName,
  studios,
  children,
}: {
  slug: string;
  studioName: string;
  studios: { slug: string; name: string }[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const base = `/portal/${slug}`;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <BrandLogo size="sm" />
            {studios.length > 1 ? (
              <Select
                value={slug}
                onValueChange={(v) => v && router.push(`/portal/${v}`)}
              >
                <SelectTrigger className="h-8 max-w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {studios.map((studio) => (
                    <SelectItem key={studio.slug} value={studio.slug}>
                      {studio.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="truncate text-sm font-semibold">{studioName}</p>
            )}
          </div>
          <LogoutButton />
        </div>
        <nav
          aria-label="Portal"
          className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-4 pb-2"
        >
          {TABS.map((tab) => {
            const href = tab.segment ? `${base}/${tab.segment}` : base;
            const active = tab.segment
              ? pathname.startsWith(href)
              : pathname === base;
            return (
              <Link
                key={tab.label}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active
                    ? "brand-gradient text-white"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main id="main-content" className="mx-auto max-w-3xl p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}
