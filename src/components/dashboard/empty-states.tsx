import { Calendar, Users, Scissors, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: { label: string; href: string };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="mesh-bg flex flex-col items-center justify-center rounded-3xl border border-dashed border-primary/25 p-12 text-center">
      <div className="brand-gradient mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-[0_10px_28px_-10px_var(--primary)]">
        {icon}
      </div>
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && (
        <LinkButton className="mt-6" href={action.href}>
          {action.label}
        </LinkButton>
      )}
    </div>
  );
}

const overviewSteps = [
  {
    icon: Scissors,
    title: "Add services",
    body: "Define what clients can book: haircuts, massages, consultations, and more.",
    tile: "bg-coral text-white",
    action: { label: "Manage services", href: "/dashboard/services", variant: "default" as const },
  },
  {
    icon: Users,
    title: "Add staff",
    body: "Add team members, assign services, and set their weekly availability.",
    tile: "bg-teal text-white",
    action: { label: "Manage staff", href: "/dashboard/staff", variant: "default" as const },
  },
];

export function DashboardOverviewEmpty({ slug }: { slug: string }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {overviewSteps.map((step) => (
        <Card key={step.title} interactive>
          <CardHeader>
            <div className={`mb-1 flex h-11 w-11 items-center justify-center rounded-2xl ${step.tile} shadow-soft`}>
              <step.icon className="h-5 w-5" />
            </div>
            <CardTitle className="text-base">{step.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">{step.body}</p>
            <LinkButton size="sm" variant={step.action.variant} href={step.action.href}>
              {step.action.label}
            </LinkButton>
          </CardContent>
        </Card>
      ))}
      <Card interactive>
        <CardHeader>
          <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-violet text-white shadow-soft">
            <ExternalLink className="h-5 w-5" />
          </div>
          <CardTitle className="text-base">Share booking link</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Your public booking page is ready once services and staff are set up.
          </p>
          <LinkButton size="sm" variant="outline" href={`/book/${slug}`} target="_blank">
            Preview booking page
          </LinkButton>
        </CardContent>
      </Card>
    </div>
  );
}

export function CalendarEmpty() {
  return (
    <EmptyState
      icon={<Calendar className="h-10 w-10" />}
      title="No appointments yet"
      description="Create your first appointment from the calendar or share your booking link with clients."
      action={{ label: "Add a service", href: "/dashboard/services" }}
    />
  );
}
