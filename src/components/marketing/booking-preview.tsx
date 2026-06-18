import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const slots = ["9:00", "9:30", "10:00", "10:30", "11:00", "11:30"];

/**
 * Decorative mini booking UI for the hero — a real composed preview built from
 * the design system (not a screenshot, not interactive). Marked aria-hidden and
 * pointer-events-none so it reads as an illustration to assistive tech.
 */
export function BookingPreview() {
  return (
    <div className="relative select-none" aria-hidden>
      <div className="float-slow absolute -right-4 -top-5 z-10 flex items-center gap-2 rounded-2xl bg-success px-3 py-2 text-sm font-bold text-white shadow-[0_12px_30px_-10px_var(--success)]">
        <Check className="h-4 w-4" />
        Booked!
      </div>

      <div className="pointer-events-none rounded-3xl border border-border/70 bg-card p-5 shadow-[0_36px_80px_-36px_var(--primary)]">
        <div className="flex items-center gap-3">
          <div className="brand-gradient flex h-10 w-10 items-center justify-center rounded-xl text-base font-black text-white">
            L
          </div>
          <div className="min-w-0">
            <p className="font-bold leading-tight">Lina&apos;s Studio</p>
            <p className="text-xs text-muted-foreground">Haircut · 45 min · $40</p>
          </div>
        </div>

        <div className="mt-4 flex gap-1.5">
          {days.map((d, i) => (
            <div
              key={d}
              className={cn(
                "flex-1 rounded-xl py-2 text-center text-xs font-semibold",
                i === 2
                  ? "bg-primary text-primary-foreground shadow-soft"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {d}
            </div>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {slots.map((s, i) => (
            <div
              key={s}
              className={cn(
                "relative rounded-xl border py-2 text-center text-xs font-medium",
                i === 3
                  ? "border-primary bg-secondary text-primary"
                  : "border-border text-foreground"
              )}
            >
              {i === 3 && (
                <span className="absolute inset-0 rounded-xl ring-2 ring-primary/40 animate-ping motion-reduce:hidden" />
              )}
              <span className="relative">{s}</span>
            </div>
          ))}
        </div>

        <div className="brand-gradient mt-4 w-full rounded-xl py-2.5 text-center text-sm font-semibold text-white shadow-[0_8px_20px_-8px_var(--primary)]">
          Confirm booking
        </div>
      </div>
    </div>
  );
}
