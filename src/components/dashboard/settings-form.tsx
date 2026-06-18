"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Clock, Trash2 } from "lucide-react";
import { settingsSchema, type SettingsInput } from "@/lib/validations";
import {
  addBusinessHoursAction,
  deleteBusinessHoursAction,
  updateSettingsAction,
} from "@/actions/dashboard";
import { BUSINESS_TYPES, DAYS_OF_WEEK, TIMEZONES } from "@/lib/constants";
import type { Business, BusinessHours } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/dashboard/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function SettingsForm({
  business,
  businessHours,
}: {
  business: Business;
  businessHours: BusinessHours[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hoursError, setHoursError] = useState<string | null>(null);
  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const settings = business.settings;

  const form = useForm<SettingsInput>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      name: business.name,
      slug: business.slug,
      businessType: business.business_type,
      timezone: business.timezone,
      slotIntervalMinutes: settings.slot_interval_minutes,
      minNoticeHours: settings.min_notice_hours,
      maxAdvanceDays: settings.max_advance_days,
      autoConfirm: settings.auto_confirm,
    },
  });

  async function onSubmit(values: SettingsInput) {
    setError(null);
    setSuccess(false);
    const result = await updateSettingsAction(values);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSuccess(true);
    router.refresh();
  }

  async function handleAddHours() {
    setHoursError(null);
    const result = await addBusinessHoursAction({
      dayOfWeek: parseInt(dayOfWeek),
      startTime,
      endTime,
    });
    if (result.error) {
      setHoursError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleDeleteHours(id: string) {
    setHoursError(null);
    const result = await deleteBusinessHoursAction(id);
    if (result.error) {
      setHoursError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your business and booking rules"
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert>
              <AlertDescription>Settings saved successfully.</AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Business details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Booking URL slug</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">/book/</span>
                        <Input {...field} />
                      </div>
                    </FormControl>
                    <FormDescription>
                      Changing this will break existing booking links
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="businessType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {BUSINESS_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timezone</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TIMEZONES.map((tz) => (
                          <SelectItem key={tz} value={tz}>
                            {tz}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" aria-hidden />
                Business hours
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Set when your business is open. Booking slots are generated from
                these hours. Staff-specific availability further restricts
                individual team members.
              </p>
              {businessHours.length ? (
                <ul className="space-y-2">
                  {businessHours.map((hours) => (
                    <li
                      key={hours.id}
                      className="flex items-center justify-between rounded-lg border p-2 text-sm"
                    >
                      <span>
                        {DAYS_OF_WEEK[hours.day_of_week]} ·{" "}
                        {hours.start_time.slice(0, 5)} – {hours.end_time.slice(0, 5)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove hours for ${DAYS_OF_WEEK[hours.day_of_week]}`}
                        onClick={() => handleDeleteHours(hours.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No business hours set yet. Add hours so clients can book online.
                </p>
              )}
              {hoursError && (
                <p className="text-sm text-destructive">{hoursError}</p>
              )}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Select value={dayOfWeek} onValueChange={(v) => v && setDayOfWeek(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map((day, i) => (
                      <SelectItem key={day} value={String(i)}>
                        {day}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
              <Button type="button" variant="outline" onClick={handleAddHours}>
                Add hours
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Booking rules</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="slotIntervalMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slot interval (minutes)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      Time between bookable slots (30 = every half hour)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="minNoticeHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum notice (hours)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="maxAdvanceDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max advance booking (days)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="autoConfirm"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <FormLabel>Auto-confirm online bookings</FormLabel>
                      <FormDescription>
                        When off, online bookings require manual approval
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Button type="submit">Save settings</Button>
        </form>
      </Form>
    </div>
  );
}
