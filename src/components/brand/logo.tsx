import Link from "next/link";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  href?: string;
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: { dot: "h-5 w-5 rounded-lg", text: "text-base" },
  md: { dot: "h-7 w-7 rounded-xl", text: "text-xl" },
  lg: { dot: "h-8 w-8 rounded-xl", text: "text-2xl" },
};

export function BrandLogo({ className, href = "/", size = "md" }: BrandLogoProps) {
  const s = sizes[size];

  const content = (
    <span className={cn("inline-flex items-center gap-2 font-extrabold tracking-tight", className)}>
      <span
        className={cn(
          "brand-gradient inline-flex items-center justify-center font-black text-white shadow-[0_4px_12px_-4px_var(--primary)]",
          s.dot
        )}
        aria-hidden
      >
        <span className="text-[0.7em] leading-none">R</span>
      </span>
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
