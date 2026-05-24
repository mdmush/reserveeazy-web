import Link from "next/link";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  href?: string;
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: { dot: "h-2 w-2", text: "text-base" },
  md: { dot: "h-2.5 w-2.5", text: "text-xl" },
  lg: { dot: "h-3 w-3", text: "text-2xl" },
};

export function BrandLogo({ className, href = "/", size = "md" }: BrandLogoProps) {
  const s = sizes[size];

  const content = (
    <span className={cn("inline-flex items-center gap-2 font-bold tracking-tight", className)}>
      <span
        className={cn("rounded-full bg-primary shadow-sm shadow-primary/30", s.dot)}
        aria-hidden
      />
      <span className={s.text}>
        Reserve<span className="text-primary">Eazy</span>
      </span>
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="rounded-lg hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        {content}
      </Link>
    );
  }

  return content;
}
