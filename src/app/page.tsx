import Link from "next/link";
import Image from "next/image";
import {
  Calendar,
  Users,
  Globe,
  Clock,
  ArrowRight,
  CheckCircle,
  Sparkles,
  ListChecks,
  Share2,
  CalendarCheck,
  Star,
  Scissors,
  Flower2,
  Brush,
  Stethoscope,
  PawPrint,
  Dumbbell,
} from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";
import { Card, CardContent } from "@/components/ui/card";
import { MarketingHeader } from "@/components/brand/marketing-header";
import { BrandLogo } from "@/components/brand/logo";
import { Reveal } from "@/components/marketing/reveal";
import { BookingPreview } from "@/components/marketing/booking-preview";
import { AmbientVideo } from "@/components/marketing/ambient-video";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: Calendar,
    title: "Online calendar",
    description:
      "Keep every appointment in one place with a clear, drag-free week view your whole team can read at a glance.",
    iconBg: "bg-primary text-primary-foreground",
    tone: "primary" as const,
    span: "lg:col-span-2",
    big: true,
  },
  {
    icon: Globe,
    title: "Online booking",
    description: "Let clients book 24/7 through your own page.",
    iconBg: "bg-coral text-white",
    tone: "coral" as const,
    span: "lg:col-span-1",
    big: false,
  },
  {
    icon: Users,
    title: "Staff & services",
    description: "Assign services and set weekly availability per person.",
    iconBg: "bg-teal text-white",
    tone: "teal" as const,
    span: "lg:col-span-1",
    big: false,
  },
  {
    icon: Clock,
    title: "Client profiles",
    description:
      "Store client details, notes, and full appointment history so every visit feels personal.",
    iconBg: "bg-violet text-white",
    tone: "violet" as const,
    span: "lg:col-span-2",
    big: true,
  },
];

const benefits = [
  "No setup fees",
  "No credit card required",
  "Works for salons, spas, barbers & more",
];

const stats = [
  { label: "Setup time", value: "1 min", color: "text-primary" },
  { label: "Credit card", value: "Not required", color: "text-teal" },
  { label: "Business types", value: "Any", color: "text-violet" },
];

const segments = [
  { icon: Scissors, label: "Salons" },
  { icon: Flower2, label: "Spas" },
  { icon: Scissors, label: "Barbershops" },
  { icon: Brush, label: "Nail studios" },
  { icon: Stethoscope, label: "Clinics" },
  { icon: PawPrint, label: "Pet grooming" },
  { icon: Dumbbell, label: "Wellness & fitness" },
];

const steps = [
  {
    icon: ListChecks,
    title: "Add services & staff",
    description: "Set what you offer and who's available in a few minutes.",
    tile: "bg-coral text-white",
  },
  {
    icon: Share2,
    title: "Share your link",
    description: "Drop it in your bio, your site, or embed it as a widget.",
    tile: "bg-teal text-white",
  },
  {
    icon: CalendarCheck,
    title: "Get booked 24/7",
    description: "Clients pick a slot and it lands on your calendar instantly.",
    tile: "bg-violet text-white",
  },
];

const testimonials = [
  {
    quote:
      "Setup took one coffee break. Clients book themselves now and my no-shows dropped.",
    name: "Marisol Vega",
    role: "Owner, Vega Hair Co.",
  },
  {
    quote:
      "The calendar is so clear my whole team finally stays in sync on a busy Saturday.",
    name: "Daniel Okafor",
    role: "Barber, Sharp & Co.",
  },
  {
    quote:
      "A booking link in my bio fills my week. No more back-and-forth in the DMs.",
    name: "Priya Nair",
    role: "Founder, Lotus Spa",
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <div
        className="scroll-progress brand-gradient fixed inset-x-0 top-0 z-[60] h-1 origin-left"
        aria-hidden
      />
      <MarketingHeader />

      <main className="flex-1" id="main-content">
        {/* Hero — cinematic footage behind copy + live booking preview */}
        <section className="relative flex min-h-[92svh] items-center overflow-hidden">
          {/* Ambience painted behind the footage: shows under reduced motion
              or if the generated assets ever fail to load */}
          <div className="mesh-bg absolute inset-0 pointer-events-none" />
          <div
            className="parallax-up float-slow pointer-events-none absolute -left-20 top-8 h-72 w-72 rounded-full bg-primary/20 blur-3xl"
            aria-hidden
          />
          <div
            className="parallax-down float-slower pointer-events-none absolute -right-16 top-28 h-80 w-80 rounded-full bg-violet/20 blur-3xl"
            aria-hidden
          />
          <AmbientVideo
            src="/videos/hero.mp4"
            poster="/images/hero-poster.webp"
            priority
          />
          {/* Scrim — keeps copy readable over the footage in both themes */}
          <div
            className="absolute inset-0 bg-gradient-to-r from-background via-background/75 to-background/25"
            aria-hidden
          />
          <div
            className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-background to-transparent"
            aria-hidden
          />
          <div className="grain-overlay absolute inset-0" aria-hidden />
          <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-20 md:py-24 lg:grid-cols-2">
            <div className="text-center lg:text-left">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/15 bg-card/80 px-4 py-1.5 text-sm font-semibold text-primary shadow-soft backdrop-blur mb-6 animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500">
                <Sparkles className="h-4 w-4" />
                Free to start, no card needed
              </span>
              <h1 className="text-5xl font-extrabold tracking-tight md:text-6xl lg:text-7xl max-w-2xl mx-auto lg:mx-0 leading-[1.05] text-balance animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-700 [animation-delay:80ms]">
                Run your bookings{" "}
                <span className="bg-gradient-to-r from-primary via-coral to-amber bg-clip-text text-transparent">
                  the easy way
                </span>
              </h1>
              <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0 text-pretty animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-700 [animation-delay:200ms]">
                Colorful, easy-to-use booking software for salons, spas, barbers,
                clinics, and any appointment-based business. Save time and grow
                your client base.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-700 [animation-delay:320ms]">
                <LinkButton size="lg" href="/signup">
                  Try it for free
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 ease-out-strong group-hover/button:translate-x-1" />
                </LinkButton>
                <LinkButton size="lg" variant="outline" href="/login">
                  Sign in
                </LinkButton>
              </div>
              <ul className="mt-8 flex flex-wrap justify-center lg:justify-start gap-x-6 gap-y-2 text-sm text-muted-foreground animate-in fade-in fill-mode-both duration-700 [animation-delay:440ms]">
                {benefits.map((b) => (
                  <li key={b} className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-teal" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>

            <Reveal from="right" delay={200} className="parallax-down">
              <div className="float-slower mx-auto w-full max-w-sm rounded-4xl bg-card/75 p-2.5 shadow-soft ring-1 ring-foreground/10 backdrop-blur-xl">
                <BookingPreview />
              </div>
            </Reveal>
          </div>
        </section>

        {/* Segment marquee (capability strip, not fake logos) */}
        <section className="border-y border-border bg-card/50 py-5">
          <div className="marquee">
            <div className="marquee-track">
              {[...segments, ...segments].map((s, i) => (
                <span
                  key={i}
                  className="mr-3 inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-muted-foreground"
                >
                  <s.icon className="h-4 w-4 text-primary" />
                  {s.label}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="relative overflow-hidden py-10">
          <div
            className="pointer-events-none absolute inset-0 opacity-35 dark:opacity-20 [mask-image:radial-gradient(70%_100%_at_50%_50%,#000,transparent)]"
            aria-hidden
          >
            <Image
              src="/images/accent-teal-violet.webp"
              alt=""
              fill
              sizes="100vw"
              className="object-cover"
            />
          </div>
          <div className="relative mx-auto max-w-6xl px-4">
            <div className="grid grid-cols-3 gap-4 text-center divide-x divide-border">
              {stats.map((stat, i) => (
                <Reveal key={stat.label} delay={i * 90} className="px-2">
                  <p
                    className={cn(
                      "text-2xl md:text-3xl font-extrabold tabular-nums",
                      stat.color
                    )}
                  >
                    {stat.value}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Feature bento */}
        <section className="py-24 md:py-28">
          <div className="mx-auto max-w-6xl px-4">
            <Reveal>
              <h2 className="text-3xl md:text-4xl font-extrabold text-center mb-3 text-balance">
                Everything you need to run bookings
              </h2>
              <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto text-pretty">
                From calendar to online booking, all in one colorful, easy-to-use platform.
              </p>
            </Reveal>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:auto-rows-fr">
              {features.map((feature, i) => (
                <Reveal
                  key={feature.title}
                  delay={i * 90}
                  from="scale"
                  className={cn(feature.span, "h-full")}
                >
                  <Card tone={feature.tone} interactive className="h-full">
                    <CardContent
                      className={cn(
                        "flex h-full flex-col",
                        feature.big ? "pt-6" : "pt-5"
                      )}
                    >
                      <div
                        className={cn(
                          "mb-4 inline-flex items-center justify-center rounded-2xl shadow-soft transition-transform duration-200 ease-out-strong group-hover/card:scale-105 group-hover/card:-rotate-3 motion-reduce:transform-none",
                          feature.big ? "h-14 w-14" : "h-12 w-12",
                          feature.iconBg
                        )}
                      >
                        <feature.icon className={feature.big ? "h-7 w-7" : "h-6 w-6"} />
                      </div>
                      <h3 className={cn("font-bold mb-2", feature.big && "text-lg")}>
                        {feature.title}
                      </h3>
                      <p className="text-sm text-muted-foreground text-pretty">
                        {feature.description}
                      </p>
                    </CardContent>
                  </Card>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="bg-muted/30 py-24 md:py-28">
          <div className="mx-auto max-w-6xl px-4">
            <Reveal>
              <h2 className="text-3xl md:text-4xl font-extrabold text-center mb-3 text-balance">
                Live in three steps
              </h2>
              <p className="text-center text-muted-foreground mb-14 max-w-xl mx-auto text-pretty">
                No manuals, no migration. You could be taking bookings before lunch.
              </p>
            </Reveal>
            <div className="relative grid gap-10 md:grid-cols-3">
              <Reveal className="absolute inset-x-[18%] top-7 hidden md:block">
                <div className="grow-line h-0.5 w-full rounded-full brand-gradient opacity-50" />
              </Reveal>
              {steps.map((step, i) => (
                <Reveal key={step.title} delay={i * 130} className="relative text-center">
                  <div
                    className={cn(
                      "mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl shadow-soft ring-4 ring-muted/30",
                      step.tile
                    )}
                  >
                    <step.icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-bold mb-2">{step.title}</h3>
                  <p className="mx-auto max-w-xs text-sm text-muted-foreground text-pretty">
                    {step.description}
                  </p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-24 md:py-28">
          <div className="mx-auto max-w-6xl px-4">
            <Reveal>
              <h2 className="text-3xl md:text-4xl font-extrabold text-center mb-12 text-balance">
                Loved by busy studios
              </h2>
            </Reveal>
            <div className="grid gap-5 md:grid-cols-3">
              {testimonials.map((t, i) => (
                <Reveal key={t.name} delay={i * 100} className="h-full">
                  <figure className="flex h-full flex-col rounded-2xl bg-card p-6 shadow-soft ring-1 ring-foreground/8">
                    <div className="flex gap-0.5 text-amber">
                      {Array.from({ length: 5 }).map((_, s) => (
                        <Star key={s} className="h-4 w-4 fill-current" />
                      ))}
                    </div>
                    <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-pretty">
                      {t.quote}
                    </blockquote>
                    <figcaption className="mt-4 text-sm">
                      <span className="font-semibold">{t.name}</span>
                      <span className="block text-muted-foreground">{t.role}</span>
                    </figcaption>
                  </figure>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 pb-24 md:pb-28">
          <Reveal from="scale">
            <div className="brand-gradient relative mx-auto max-w-6xl overflow-hidden rounded-4xl px-6 py-16 text-center text-white shadow-[0_30px_70px_-30px_var(--primary)] md:py-20">
              <AmbientVideo
                src="/videos/cta-gradient.mp4"
                poster="/images/cta-poster.webp"
              />
              <div className="absolute inset-0 bg-black/30" aria-hidden />
              <div className="float-slow pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
              <div className="float-slower pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
              <div className="relative">
                <h2 className="text-3xl md:text-4xl font-extrabold mb-4 text-balance">
                  Setting up your account takes just a minute
                </h2>
                <p className="text-white/90 mb-8 max-w-xl mx-auto text-pretty">
                  Advanced yet easy. ReserveEazy is designed for teams and individuals
                  across any appointment-based business.
                </p>
                <LinkButton
                  size="lg"
                  href="/signup"
                  className="bg-white! bg-none! text-primary shadow-lg hover:bg-white/90!"
                >
                  Get started free
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 ease-out-strong group-hover/button:translate-x-1" />
                </LinkButton>
                <p className="mt-4 text-sm text-white/80">No credit card required.</p>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-border py-8 bg-background">
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
