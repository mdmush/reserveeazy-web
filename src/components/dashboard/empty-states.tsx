import { Calendar, Users, Scissors, ExternalLink } from "lucide-react";
import Link from "next/link";
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
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-primary/20 bg-accent/30 p-12 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && (
        <LinkButton className="mt-6" href={action.href}>
          {action.label}
        </LinkButton>
      )}
    </div>
  );
}

export function DashboardOverviewEmpty({ slug }: { slug: string }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Scissors className="h-4 w-4" />
            Add services
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Define what clients can book — haircuts, massages, consultations, and more.
          </p>
          <LinkButton size="sm" href="/dashboard/services">
            Manage services
          </LinkButton>
        </CardContent>
      </Card>
      <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Add staff
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Add team members, assign services, and set their weekly availability.
          </p>
          <LinkButton size="sm" href="/dashboard/staff">
            Manage staff
          </LinkButton>
        </CardContent>
      </Card>
      <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ExternalLink className="h-4 w-4" />
            Share booking link
          </CardTitle>
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
