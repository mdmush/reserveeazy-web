"use client";

import { useEffect, useState } from "react";
import { format, addDays } from "date-fns";
import { ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import { createPublicBookingAction } from "@/actions/dashboard";
import { formatPrice, formatDuration } from "@/lib/format";
import { formatSlot, formatSlotDate } from "@/lib/booking/slots";
import type {
  Business,
  Service,
  BusinessMember,
  StaffAvailability,
  Appointment,
} from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StaffWithServices = BusinessMember & {
  staff_services: { service_id: string }[];
  staff_availability: StaffAvailability[];
};

interface BookingWidgetProps {
  business: Business;
  services: Service[];
  staff: StaffWithServices[];
  slotsByStaff: Record<string, string[]>;
  appointments: Pick<Appointment, "start_at" | "end_at" | "status" | "staff_member_id">[];
}

type Step = "service" | "staff" | "datetime" | "details" | "confirmed";

const STEPS: { key: Step; label: string }[] = [
  { key: "service", label: "Service" },
  { key: "staff", label: "Staff" },
  { key: "datetime", label: "Time" },
  { key: "details", label: "Details" },
];

function stepIndex(step: Step): number {
  if (step === "confirmed") return STEPS.length;
  return STEPS.findIndex((s) => s.key === step);
}

export function BookingWidget({
  business,
  services,
  staff,
  slotsByStaff,
}: BookingWidgetProps) {
  const [step, setStep] = useState<Step>("service");
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const stepHeadingId = "booking-step-heading";
  const confirmHeadingId = "booking-confirm-heading";

  useEffect(() => {
    const id = step === "confirmed" ? confirmHeadingId : stepHeadingId;
    document.getElementById(id)?.focus();
  }, [step]);

  const selectedService = services.find((s) => s.id === serviceId);
  const selectedStaff = staff.find((s) => s.id === staffId);

  const availableStaff = serviceId
    ? staff.filter((s) =>
        s.staff_services.some((ss) => ss.service_id === serviceId)
      )
    : staff;

  const slots = staffId ? slotsByStaff[staffId] ?? [] : [];
  const dateSlots = slots.filter((slot) => slot.startsWith(selectedDate));
  const currentStepIndex = stepIndex(step);

  async function handleConfirm() {
    if (!serviceId || !staffId || !selectedSlot || !fullName) return;
    setLoading(true);
    setError(null);
    const result = await createPublicBookingAction({
      businessSlug: business.slug,
      serviceId,
      staffMemberId: staffId,
      startAt: selectedSlot,
      fullName,
      email: email || undefined,
      phone: phone || undefined,
    });
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setStep("confirmed");
  }

  const cardButtonClass =
    "w-full rounded-xl border p-4 text-left cursor-pointer transition-colors motion-reduce:transition-none hover:border-primary hover:bg-accent/50 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-[0.98] motion-reduce:transform-none";

  if (step === "confirmed" && selectedService && selectedStaff && selectedSlot) {
    return (
      <Card
        className="max-w-lg mx-auto shadow-lg border-primary/10"
        role="status"
        aria-live="polite"
      >
        <CardContent className="pt-10 pb-10 text-center space-y-5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle2 className="h-9 w-9 text-primary" aria-hidden />
          </div>
          <div>
            <h2
              id={confirmHeadingId}
              tabIndex={-1}
              className="text-2xl font-bold tracking-tight outline-none"
            >
              Booking confirmed!
            </h2>
            <p className="text-muted-foreground mt-1">
              We look forward to seeing you.
            </p>
          </div>
          <div className="rounded-xl bg-accent/60 p-4 text-sm text-left space-y-2">
            <p className="font-medium text-accent-foreground">{selectedService.name}</p>
            <p className="text-muted-foreground">with {selectedStaff.display_name}</p>
            <p className="text-muted-foreground">{formatSlotDate(selectedSlot, business.timezone)}</p>
            <p className="font-medium text-primary">{formatSlot(selectedSlot, business.timezone)}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">{business.name}</h1>
        <p className="text-muted-foreground mt-1">Book an appointment</p>
        <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-primary" aria-hidden />
      </div>

      <ol
        className="flex items-start justify-between gap-1 px-2"
        aria-label="Booking progress"
      >
        {STEPS.map((s, i) => {
          const isActive = step === s.key;
          const isComplete = currentStepIndex > i;
          return (
            <li key={s.key} className="flex flex-1 flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold motion-reduce:transition-none transition-colors",
                  isActive && "bg-primary text-primary-foreground shadow-md",
                  isComplete && !isActive && "bg-primary/20 text-primary",
                  !isActive && !isComplete && "bg-muted text-muted-foreground"
                )}
                aria-current={isActive ? "step" : undefined}
              >
                <span className="sr-only">{s.label}: </span>
                {i + 1}
              </div>
              <span
                className={cn(
                  "text-xs font-medium",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
                aria-hidden
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>

      {step === "service" && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle
              id={stepHeadingId}
              tabIndex={-1}
              role="heading"
              aria-level={2}
              className="outline-none text-lg font-semibold"
            >
              Choose a service
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {services.length === 0 ? (
              <p className="text-sm text-muted-foreground">No services available.</p>
            ) : (
              services.map((service) => (
                <button
                  key={service.id}
                  type="button"
                  aria-label={`${service.name}, ${formatDuration(service.duration_minutes)}, ${formatPrice(service.price_cents)}`}
                  onClick={() => {
                    setServiceId(service.id);
                    setStaffId(null);
                    setSelectedSlot(null);
                    setStep("staff");
                  }}
                  className={cardButtonClass}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{service.name}</p>
                      {service.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {service.description}
                        </p>
                      )}
                    </div>
                    <div className="text-right text-sm shrink-0 ml-4">
                      <p>{formatDuration(service.duration_minutes)}</p>
                      <p className="text-muted-foreground">
                        {formatPrice(service.price_cents)}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {step === "staff" && (
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Back to service selection"
              onClick={() => setStep("service")}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Button>
            <CardTitle
              id={stepHeadingId}
              tabIndex={-1}
              role="heading"
              aria-level={2}
              className="outline-none text-lg font-semibold"
            >
              Choose staff
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {availableStaff.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No staff available for this service.
              </p>
            ) : (
              availableStaff.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  aria-label={`Book with ${member.display_name}`}
                  onClick={() => {
                    setStaffId(member.id);
                    setSelectedSlot(null);
                    setStep("datetime");
                  }}
                  className={cardButtonClass}
                >
                  <p className="font-medium">{member.display_name}</p>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {step === "datetime" && selectedService && (
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Back to staff selection"
              onClick={() => setStep("staff")}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Button>
            <CardTitle
              id={stepHeadingId}
              tabIndex={-1}
              role="heading"
              aria-level={2}
              className="outline-none text-lg font-semibold"
            >
              Choose date & time
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="icon"
                aria-label="Previous day"
                onClick={() =>
                  setSelectedDate(format(addDays(new Date(selectedDate), -1), "yyyy-MM-dd"))
                }
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </Button>
              <span className="text-sm font-medium">
                {format(new Date(selectedDate + "T12:00:00"), "EEE, MMM d")}
              </span>
              <Button
                variant="outline"
                size="icon"
                aria-label="Next day"
                onClick={() =>
                  setSelectedDate(format(addDays(new Date(selectedDate), 1), "yyyy-MM-dd"))
                }
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Button>
            </div>
            {dateSlots.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No available slots on this day. Try another date.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {dateSlots.map((slot) => (
                  <Button
                    key={slot}
                    variant={selectedSlot === slot ? "default" : "outline"}
                    className={cn(
                      selectedSlot !== slot &&
                        "hover:border-primary hover:bg-accent/50"
                    )}
                    onClick={() => {
                      setSelectedSlot(slot);
                      setStep("details");
                    }}
                  >
                    {formatSlot(slot, business.timezone)}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === "details" && selectedService && selectedStaff && selectedSlot && (
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Back to date and time selection"
              onClick={() => setStep("datetime")}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Button>
            <CardTitle
              id={stepHeadingId}
              tabIndex={-1}
              role="heading"
              aria-level={2}
              className="outline-none text-lg font-semibold"
            >
              Your details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl bg-accent/60 p-3 text-sm space-y-1">
              <p className="font-medium">{selectedService.name}</p>
              <p className="text-muted-foreground">with {selectedStaff.display_name}</p>
              <p className="text-muted-foreground">
                {formatSlotDate(selectedSlot, business.timezone)} at{" "}
                {formatSlot(selectedSlot, business.timezone)}
              </p>
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">Full name *</Label>
              <Input
                id="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
              />
            </div>
            <Button
              className="w-full"
              onClick={handleConfirm}
              disabled={loading || !fullName}
              aria-busy={loading}
            >
              {loading ? "Booking..." : "Confirm booking"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
