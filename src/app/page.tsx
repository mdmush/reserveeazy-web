import Link from "next/link";
import {
  Calendar,
  Users,
  Globe,
  Clock,
  ArrowRight,
  CheckCircle,
  Sparkles,
} from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";
import { Card, CardContent } from "@/components/ui/card";
import { MarketingHeader } from "@/components/brand/marketing-header";
import { BrandLogo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: Calendar,
    title: "Online calendar",
    description:
      "Keep track of all appointments in one place with a clear week view.",
    iconBg: "bg-primary/10 text-primary",
  },
  {
    icon: Globe,
    title: "Online booking",
    description:
      "Let clients book 24/7 through your personalized booking page.",
    iconBg: "bg-chart-2/15 text-chart-2",
  },
  {
    icon: Users,
    title: "Staff & services",
    description:
      "Manage team members, assign services, and set weekly availability.",
    iconBg: "bg-chart-3/15 text-chart-3",
  },
  {
    icon: Clock,
    title: "Client profiles",
    description:
      "Store client details, notes, and full appointment history.",
    iconBg: "bg-chart-4/15 text-chart-4",
  },
];

const benefits = [
  "No setup fees",
  "No credit card required",
  "Works for salons, spas, barbers & more",
];

const stats = [
  { label: "Setup time", value: "1 min" },
  { label: "Credit card", value: "Not required" },
  { label: "Business types", value: "Any" },
];

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <MarketingHeader />

      <main className="flex-1" id="main-content">
        <section className="relative overflow-hidden">
          <div className="hero-glow absolute inset-0 pointer-events-none" />
          <div className="relative mx-auto max-w-6xl px-4 py-20 md:py-28 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground mb-6">
              <Sparkles className="h-4 w-4 text-primary" />
              Free to start
            </span>
            <h1 className="text-4xl font-bold tracking-tight md:text-6xl max-w-3xl mx-auto">
              The complete toolkit for{" "}
              <span className="text-primary">managing appointments</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
              Easy-to-use booking software for salons, spas, barbers, clinics, and
              any appointment-based business. Save time and grow your client base.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
              <LinkButton size="lg" href="/signup">
                Try it for free
                <ArrowRight className="ml-2 h-4 w-4" />
              </LinkButton>
              <LinkButton size="lg" variant="outline" href="/login">
                Sign in
              </LinkButton>
            </div>
            <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {benefits.map((b) => (
                <li key={b} className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-y border-border bg-secondary/50 py-8">
          <div className="mx-auto max-w-6xl px-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <p className="text-2xl font-bold text-primary">{stat.value}</p>
                  <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-2xl font-bold text-center mb-3">
              Everything you need to run bookings
            </h2>
            <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
              From calendar to online booking — all in one colorful, easy-to-use platform.
            </p>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => (
                <Card
                  key={feature.title}
                  className="border-border/60 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 motion-reduce:transform-none"
                >
                  <CardContent className="pt-6">
                    <div
                      className={cn(
                        "mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl",
                        feature.iconBg
                      )}
                    >
                      <feature.icon className="h-6 w-6" />
                    </div>
                    <h3 className="font-semibold mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="brand-gradient py-16 md:py-20">
          <div className="mx-auto max-w-6xl px-4 text-center text-white">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Setting up your account takes just a minute
            </h2>
            <p className="text-white/85 mb-8 max-w-xl mx-auto">
              Advanced yet easy. ReserveEazy is designed for teams and individuals
              across any appointment-based business.
            </p>
            <LinkButton
              size="lg"
              href="/signup"
              className="bg-white text-primary hover:bg-white/90 shadow-lg"
            >
              Get started — no credit card required
            </LinkButton>
          </div>
        </section>
      </main>

      <footer className="border-t border-primary/10 py-8 bg-background">
        <div className="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <BrandLogo size="sm" href="/" />
          <div className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/login" className="hover:text-primary transition-colors">
              Sign in
            </Link>
            <Link href="/signup" className="hover:text-primary transition-colors">
              Sign up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
