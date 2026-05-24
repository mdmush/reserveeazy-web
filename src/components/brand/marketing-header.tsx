import { LinkButton } from "@/components/ui/link-button";
import { BrandLogo } from "@/components/brand/logo";

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <BrandLogo size="md" />
        <nav className="flex items-center gap-2 sm:gap-3" aria-label="Primary">
          <LinkButton variant="ghost" href="/login">
            Sign in
          </LinkButton>
          <LinkButton href="/signup">Try it free</LinkButton>
        </nav>
      </div>
    </header>
  );
}
