import { CheckCircle2 } from "lucide-react";
import { BrandLogo } from "@/components/brand/logo";

const benefits = [
  "Online booking in minutes",
  "Calendar & client management",
  "Works for any appointment business",
];

interface AuthShellProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  step?: { current: number; total: number };
}

export function AuthShell({ children, title, subtitle, step }: AuthShellProps) {
  const progressPercent = step
    ? Math.round((step.current / step.total) * 100)
    : 0;

  return (
    <div className="flex min-h-screen">
      <div className="relative hidden overflow-hidden lg:flex lg:w-[45%] brand-gradient flex-col justify-between p-10 text-white">
        <div className="pointer-events-none absolute -right-20 -top-16 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-amber/30 blur-3xl" />
        <BrandLogo href="/" className="relative text-white [&_span:last-child]:text-white" />
        <div className="relative space-y-6">
          <p className="text-4xl font-extrabold leading-[1.1]">
            Run your bookings
            <br />
            the easy way
          </p>
          <p className="text-white/85 text-lg max-w-md">
            The complete toolkit for salons, spas, barbers, and any business that
            runs on appointments.
          </p>
          <ul className="space-y-3">
            {benefits.map((b) => (
              <li key={b} className="flex items-center gap-3 text-white/90">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20">
                  <CheckCircle2 className="h-4 w-4 text-white" aria-hidden />
                </span>
                {b}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-white/70">Trusted by appointment-based businesses</p>
      </div>

      <main
        id="main-content"
        className="flex flex-1 flex-col items-center justify-center bg-background p-4 sm:p-8"
      >
        <div className="mb-8 lg:hidden">
          <BrandLogo size="lg" />
        </div>
        {step && (
          <div className="mb-6 w-full max-w-md">
            <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
              <span id="onboarding-progress-label">
                Step {step.current} of {step.total}
              </span>
              <span aria-hidden>{progressPercent}%</span>
            </div>
            <div
              role="progressbar"
              aria-labelledby="onboarding-progress-label"
              aria-valuenow={step.current}
              aria-valuemin={1}
              aria-valuemax={step.total}
              className="h-2 rounded-full bg-muted overflow-hidden"
            >
              <div
                className="h-full brand-gradient motion-reduce:transition-none transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
        {(title || subtitle) && (
          <div className="mb-6 w-full max-w-md text-center lg:text-left">
            {title && <h1 className="text-2xl font-bold">{title}</h1>}
            {subtitle && (
              <p className="mt-2 text-muted-foreground">{subtitle}</p>
            )}
          </div>
        )}
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
