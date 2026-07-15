"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface Beat {
  title: string;
  description: string;
}

interface ScrollFilmProps {
  src: string;
  poster: string;
  heading: string;
  subheading?: string;
  beats: Beat[];
}

const beatTones = [
  "bg-coral text-white",
  "bg-teal text-white",
  "bg-violet text-white",
];

/**
 * Pinned scroll-scrubbed film section. The outer section is 300vh tall while
 * the inner viewport sticks; scroll progress drives video.currentTime on an
 * all-keyframe MP4, and copy beats fade in/out at progress ranges.
 *
 * Server HTML (and reduced-motion / video-error clients) render the STATIC
 * mode instead: poster frame + the numbered step grid, so the section always
 * communicates the steps. The scrub upgrade is a post-hydration state flip.
 */
export function ScrollFilm({
  src,
  poster,
  heading,
  subheading,
  beats,
}: ScrollFilmProps) {
  const outerRef = React.useRef<HTMLElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const beatRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const [scrub, setScrub] = React.useState(false);
  const [nearView, setNearView] = React.useState(false);
  const [videoReady, setVideoReady] = React.useState(false);

  // Upgrade to scrub mode after hydration unless the user prefers reduced motion.
  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const raf = requestAnimationFrame(() => setScrub(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Lazy-mount the video only when the section approaches the viewport.
  React.useEffect(() => {
    if (!scrub) return;
    const el = outerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      const raf = requestAnimationFrame(() => setNearView(true));
      return () => cancelAnimationFrame(raf);
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNearView(true);
          io.disconnect();
        }
      },
      { rootMargin: "150% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [scrub]);

  // Scroll → progress → seek-gated currentTime + beat opacity, all in one rAF.
  React.useEffect(() => {
    if (!scrub) return;
    const outer = outerRef.current;
    if (!outer) return;
    const video = videoRef.current;

    let raf = 0;
    let seeking = false;
    let pendingTime = -1;
    let primed = false;

    const seekTo = (t: number) => {
      pendingTime = t;
      if (!video || seeking) return;
      seeking = true;
      video.currentTime = t;
    };

    const onSeeked = () => {
      seeking = false;
      if (
        video &&
        pendingTime >= 0 &&
        Math.abs(video.currentTime - pendingTime) > 0.03
      ) {
        seekTo(pendingTime);
      }
    };

    const update = () => {
      raf = 0;
      const rect = outer.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const progress =
        total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;

      if (video && video.duration && !Number.isNaN(video.duration)) {
        if (!primed) {
          // One play/pause primes the decoder so seeks render frames (iOS).
          primed = true;
          video
            .play()
            .then(() => video.pause())
            .catch(() => {});
        }
        seekTo(progress * Math.max(0, video.duration - 0.05));
      }

      const n = beats.length;
      const ramp = 0.06;
      beatRefs.current.forEach((el, i) => {
        if (!el) return;
        const startP = i / n + 0.03;
        const endP = (i + 1) / n - 0.03;
        let o = 0;
        if (progress >= startP && progress <= endP) {
          o = Math.max(
            0,
            Math.min(1, (progress - startP) / ramp, (endP - progress) / ramp)
          );
        }
        el.style.opacity = String(o);
        el.style.transform = `translateY(${(1 - o) * 16}px)`;
      });
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    video?.addEventListener("seeked", onSeeked);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    onScroll();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      video?.removeEventListener("seeked", onSeeked);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
    // videoReady in deps: re-run once metadata lands so the first seek doesn't
    // wait for the next scroll event.
  }, [scrub, nearView, videoReady, beats.length]);

  if (!scrub) {
    return (
      <section ref={outerRef} className="bg-muted/30 py-24 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-3 text-center text-3xl font-extrabold text-balance md:text-4xl">
            {heading}
          </h2>
          {subheading && (
            <p className="mx-auto mb-12 max-w-xl text-center text-muted-foreground text-pretty">
              {subheading}
            </p>
          )}
          <div className="mb-14 overflow-hidden rounded-4xl shadow-soft ring-1 ring-foreground/10">
            <Image
              src={poster}
              alt=""
              width={1440}
              height={810}
              className="w-full object-cover"
              aria-hidden
            />
          </div>
          <div className="grid gap-10 md:grid-cols-3">
            {beats.map((beat, i) => (
              <div key={beat.title} className="relative text-center">
                <span
                  className={cn(
                    "mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-black shadow-soft ring-4 ring-muted/30",
                    beatTones[i % beatTones.length]
                  )}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mb-2 font-bold">{beat.title}</h3>
                <p className="mx-auto max-w-xs text-sm text-muted-foreground text-pretty">
                  {beat.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section ref={outerRef} className="relative h-[300vh]">
      <div className="sticky top-0 flex h-svh flex-col justify-between overflow-hidden">
        {/* Film layer */}
        <div className="absolute inset-0" aria-hidden>
          <Image
            src={poster}
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
          />
          {nearView && (
            <video
              ref={videoRef}
              src={src}
              muted
              playsInline
              preload="auto"
              tabIndex={-1}
              onLoadedMetadata={() => setVideoReady(true)}
              onError={() => setScrub(false)}
              className={cn(
                "absolute inset-0 h-full w-full object-cover transition-opacity duration-500",
                videoReady ? "opacity-100" : "opacity-0"
              )}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/35 to-background/10" />
          <div className="grain-overlay absolute inset-0" />
        </div>

        {/* Heading */}
        <div className="relative mx-auto w-full max-w-6xl px-4 pt-24 md:pt-28">
          <h2 className="max-w-xl text-3xl font-extrabold text-balance md:text-4xl">
            {heading}
          </h2>
          {subheading && (
            <p className="mt-3 max-w-md text-muted-foreground text-pretty">
              {subheading}
            </p>
          )}
        </div>

        {/* Copy beats — lower third, driven by scroll progress */}
        <div className="relative mx-auto w-full max-w-6xl px-4 pb-16 md:pb-24">
          <div className="relative h-44 md:h-40">
            {beats.map((beat, i) => (
              <div
                key={beat.title}
                ref={(el) => {
                  beatRefs.current[i] = el;
                }}
                className="absolute inset-x-0 bottom-0 max-w-xl opacity-0 will-change-transform"
              >
                <span
                  className={cn(
                    "mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-base font-black shadow-soft",
                    beatTones[i % beatTones.length]
                  )}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mb-2 text-xl font-bold md:text-2xl">
                  {beat.title}
                </h3>
                <p className="max-w-md text-sm text-muted-foreground md:text-base">
                  {beat.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* The beats fade visually; keep the full list for assistive tech */}
        <ol className="sr-only">
          {beats.map((beat) => (
            <li key={beat.title}>
              {beat.title} — {beat.description}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
