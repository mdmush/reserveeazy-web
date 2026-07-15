"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface AmbientVideoProps {
  src: string;
  poster: string;
  /** Load immediately (hero) instead of waiting until the section nears the viewport. */
  priority?: boolean;
  className?: string;
}

/**
 * Decorative full-bleed background video with a poster-first fallback chain:
 * whatever is painted behind this layer → poster image → video.
 * The <video> is never mounted under prefers-reduced-motion, is lazy-mounted
 * via IntersectionObserver unless `priority`, and unmounts itself on error so
 * the poster (or the layer behind it) always carries the visual.
 */
export function AmbientVideo({
  src,
  poster,
  priority = false,
  className,
}: AmbientVideoProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [showVideo, setShowVideo] = React.useState(false);
  const [playing, setPlaying] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    if (priority || typeof IntersectionObserver === "undefined") {
      // Deferred to rAF so hydration completes before the video mounts.
      const raf = requestAnimationFrame(() => setShowVideo(true));
      return () => cancelAnimationFrame(raf);
    }

    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShowVideo(true);
          io.disconnect();
        }
      },
      { rootMargin: "100% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [priority]);

  return (
    <div
      ref={ref}
      className={cn("absolute inset-0 overflow-hidden", className)}
      aria-hidden
    >
      <Image
        src={poster}
        alt=""
        fill
        priority={priority}
        sizes="100vw"
        className="object-cover"
      />
      {showVideo && !failed && (
        <video
          src={src}
          autoPlay
          muted
          loop
          playsInline
          preload={priority ? "metadata" : "none"}
          tabIndex={-1}
          onCanPlay={() => setPlaying(true)}
          onError={() => setFailed(true)}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-700",
            playing ? "opacity-100" : "opacity-0"
          )}
        />
      )}
    </div>
  );
}
