"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { settingsSchema, type SettingsInput } from "@/lib/validations";
import { updateSettingsAction } from "@/actions/dashboard";
import { BUSINESS_TYPES, TIMEZONES } from "@/lib/constants";
import type { Business } from "@/types/database";
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

export function SettingsForm({ business }: { business: Business }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
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
