import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";

export function StudioPicker({
  studios,
}: {
  studios: { slug: string; name: string; memberName: string }[];
}) {
  return (
    <div className="space-y-6">
      <PageHeader title="Your studios" description="Pick a studio to continue" />
      <div className="grid gap-2">
        {studios.map((studio) => (
          <Link
            key={studio.slug}
            href={`/portal/${studio.slug}`}
            className="flex items-center justify-between rounded-2xl border bg-card p-4 shadow-soft hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <div>
              <p className="font-semibold">{studio.name}</p>
              <p className="text-sm text-muted-foreground">{studio.memberName}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
          </Link>
        ))}
      </div>
    </div>
  );
}
