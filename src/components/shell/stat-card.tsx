import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const tones = {
  primary: { title: "text-primary", chip: "bg-primary text-primary-foreground" },
  coral: { title: "text-coral-foreground", chip: "bg-coral text-white" },
  amber: { title: "text-amber-foreground", chip: "bg-amber text-white" },
  teal: { title: "text-teal-foreground", chip: "bg-teal text-white" },
  blue: { title: "text-blue-foreground", chip: "bg-blue text-white" },
  violet: { title: "text-violet-foreground", chip: "bg-violet text-white" },
} as const;

export type StatTone = keyof typeof tones;

interface StatCardProps {
  title: string;
  tone?: StatTone;
  icon?: LucideIcon;
  /** Canonical stat number/text. Omit and pass children for custom content. */
  value?: React.ReactNode;
  children?: React.ReactNode;
}

export function StatCard({
  title,
  tone = "primary",
  icon: Icon,
  value,
  children,
}: StatCardProps) {
  return (
    <Card tone={tone}>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className={cn("text-sm font-semibold", tones[tone].title)}>
          {title}
        </CardTitle>
        {Icon && (
          <span
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl shadow-soft",
              tones[tone].chip
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        )}
      </CardHeader>
      <CardContent>
        {value !== undefined ? (
          <p className="text-3xl font-extrabold tabular-nums">{value}</p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
