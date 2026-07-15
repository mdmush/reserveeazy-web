import Link from "next/link";
import { getCurrentUser } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { LinkButton } from "@/components/ui/link-button";
import { BrandLogo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";

function getInitials(name: string, email: string | null) {
  const trimmed = name.trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return trimmed.slice(0, 2).toUpperCase();
  }
  return (email?.slice(0, 2) ?? "?").toUpperCase();
}

export async function MarketingHeader() {
  const user = await getCurrentUser();

  let authNav: { displayName: string; email: string | null; href: string } | null =
    null;

  if (user) {
    const supabase = await createClient();
    const [{ data: profile }, { data: membership }] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, email, is_superuser")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("business_members")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle(),
    ]);

    let href = "/onboarding";
    if (membership) href = "/dashboard";
    else if (profile?.is_superuser) href = "/admin";

    const displayName =
      profile?.full_name?.trim() ||
      user.user_metadata?.full_name ||
      user.email?.split("@")[0] ||
      "Account";

    authNav = {
      displayName,
      email: profile?.email ?? user.email ?? null,
      href,
    };
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <BrandLogo size="md" />
        <nav className="flex items-center gap-2 sm:gap-3" aria-label="Primary">
          <ThemeToggle />
          {authNav ? (
            <Link
              href={authNav.href}
              className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 min-h-11 hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              aria-label={`Go to dashboard as ${authNav.displayName}`}
            >
              <span
                className="brand-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-soft"
                aria-hidden
              >
                {getInitials(authNav.displayName, authNav.email)}
              </span>
              <span className="text-sm font-medium max-w-[160px] truncate">
                {authNav.displayName}
              </span>
            </Link>
          ) : (
            <>
              <LinkButton variant="ghost" href="/login">
                Sign in
              </LinkButton>
              <LinkButton href="/signup">Try it free</LinkButton>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
