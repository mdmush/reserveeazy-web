"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface RevealProps extends React.ComponentProps<"div"> {
  /** Delay in ms before the entrance transition starts (for staggering). */
  delay?: number;
  /** Entrance direction. Default "up". */
  from?: "up" | "left" | "right" | "scale";
}

/**
 * Scroll-triggered entrance wrapper.
 * Uses IntersectionObserver (no scroll listener) and CSS transitions —
 * transform + opacity only. Reveals immediately under prefers-reduced-motion
 * or when IntersectionObserver is unavailable, so content is never stuck hidden.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  from = "up",
  style,
  ...props
}: RevealProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // Reveal immediately when motion is reduced, IO is unavailable, or the
    // element is already within/above the viewport on mount (above-the-fold
    // entrance). Deferred to rAF so the entrance transition actually plays and
    // content is never stuck hidden.
    if (
      reduce ||
      typeof IntersectionObserver === "undefined" ||
      el.getBoundingClientRect().top < window.innerHeight * 0.92
    ) {
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-reveal={from}
      className={cn("reveal", visible && "is-visible", className)}
      style={{ transitionDelay: visible ? `${delay}ms` : "0ms", ...style }}
      {...props}
    >
      {children}
    </div>
  );
}
