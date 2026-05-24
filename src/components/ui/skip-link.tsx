import Link from "next/link";
import { cn } from "@/lib/utils";

export function SkipLink({ className }: { className?: string }) {
  return (
    <Link
      href="#main-content"
      className={cn(
        "sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg focus:outline-none",
        className
      )}
    >
      Skip to main content
    </Link>
  );
}
