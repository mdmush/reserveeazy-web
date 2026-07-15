import { Calendar, Users, Scissors, LayoutDashboard, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];

/** column-index → list of { row, span, tone, label } appointment blocks */
const blocks: Record<
  number,
  { row: number; span: number; tone: string; label: string }[]
> = {
  0: [
    { row: 1, span: 2, tone: "bg-coral-soft text-coral-foreground", label: "Cut & style" },
    { row: 4, span: 1, tone: "bg-teal-soft text-teal-foreground", label: "Beard trim" },
  ],
  1: [
    { row: 2, span: 2, tone: "bg-violet-soft text-violet-foreground", label: "Color" },
    { row: 5, span: 1, tone: "bg-amber-soft text-amber-foreground", label: "Blowout" },
  ],
  2: [
    { row: 1, span: 1, tone: "bg-teal-soft text-teal-foreground", label: "Consult" },
    { row: 3, span: 2, tone: "bg-coral-soft text-coral-foreground", label: "Balayage" },
  ],
  3: [
    { row: 2, span: 1, tone: "bg-amber-soft text-amber-foreground", label: "Kids cut" },
    { row: 4, span: 2, tone: "bg-violet-soft text-violet-foreground", label: "Spa facial" },
  ],
  4: [
    { row: 1, span: 2, tone: "bg-teal-soft text-teal-foreground", label: "Highlights" },
    { row: 5, span: 1, tone: "bg-coral-soft text-coral-foreground", label: "Style" },
  ],
};

const sideIcons = [LayoutDashboard, Calendar, Scissors, Users];

/**
 * Decorative dashboard mock for the product demo section — composed from the
 * design system (not a screenshot) so it stays crisp and theme-aware.
 * aria-hidden + pointer-events-none: reads as an illustration to assistive tech.
 */
export function DashboardPreview() {
  return (
    <div className="relative select-none" aria-hidden>
      <div className="float-slow absolute -right-3 -top-5 z-10 flex items-center gap-2 rounded-2xl bg-teal px-3 py-2 text-sm font-bold text-white shadow-[0_12px_30px_-10px_var(--teal)]">
        <TrendingUp className="h-4 w-4" />
        +32% bookings
      </div>

      <div className="pointer-events-none overflow-hidden rounded-3xl border border-border/70 bg-card shadow-[0_36px_80px_-36px_var(--primary)]">
        {/* Browser chrome */}
        <div className="flex items-center gap-3 border-b border-border/70 bg-muted/40 px-4 py-2.5">
          <span className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-coral/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
          </span>
          <span className="mx-auto flex-1 max-w-xs truncate rounded-full bg-background px-3 py-1 text-center text-[11px] text-muted-foreground ring-1 ring-border/70">
            reserveeazy.com/dashboard
          </span>
          <span className="w-10" />
        </div>

        <div className="flex">
          {/* Sidebar strip */}
          <div className="hidden w-12 shrink-0 flex-col items-center gap-2 border-r border-border/70 py-3 sm:flex">
            <span className="brand-gradient mb-1 flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-black text-white">
              R
            </span>
            {sideIcons.map((Icon, i) => (
              <span
                key={i}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-lg",
                  i === 1
                    ? "bg-secondary text-primary"
                    : "text-muted-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
            ))}
          </div>

          {/* Week calendar */}
          <div className="flex-1 p-3 sm:p-4">
            <div className="mb-2 grid grid-cols-5 gap-1.5">
              {days.map((d, i) => (
                <div
                  key={d}
                  className={cn(
                    "rounded-lg py-1 text-center text-[11px] font-semibold",
                    i === 2
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid h-48 grid-cols-5 gap-1.5 sm:h-56">
              {days.map((_, col) => (
                <div
                  key={col}
                  className="grid grid-rows-6 gap-1 rounded-lg bg-muted/30 p-1"
                >
                  {(blocks[col] ?? []).map((b) => (
                    <div
                      key={b.label}
                      className={cn(
                        "flex items-start rounded-md px-1.5 py-1 text-[10px] font-semibold leading-tight",
                        b.tone
                      )}
                      style={{ gridRow: `${b.row} / span ${b.span}` }}
                    >
                      {b.label}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
