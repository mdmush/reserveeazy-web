"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parseISO } from "date-fns";
import { clientSchema, type ClientInput } from "@/lib/validations";
import { updateClientAction } from "@/actions/dashboard";
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_BADGE } from "@/lib/constants";
import type { Client, Appointment } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

type AppointmentWithRelations = Appointment & {
  services: { name: string } | null;
  business_members: { display_name: string } | null;
};

export function ClientDetail({
  client,
  appointments,
}: {
  client: Client;
  appointments: AppointmentWithRelations[];
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);

  const form = useForm<ClientInput>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      fullName: client.full_name,
      email: client.email ?? "",
      phone: client.phone ?? "",
      notes: client.notes ?? "",
    },
  });

  async function onSubmit(values: ClientInput) {
    const result = await updateClientAction(client.id, values);
    if (!result.error) {
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={client.full_name} description="Client profile" />

      <Card>
        <CardHeader>
          <CardTitle>Contact details</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit">{saved ? "Saved!" : "Save changes"}</Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appointment history</CardTitle>
        </CardHeader>
        <CardContent>
          {!appointments.length ? (
            <p className="text-sm text-muted-foreground">No appointments yet.</p>
          ) : (
            <ul className="space-y-3">
              {appointments.map((apt) => (
                <li
                  key={apt.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{apt.services?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      with {apt.business_members?.display_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(parseISO(apt.start_at), "EEE, MMM d, yyyy · h:mm a")}
                    </p>
                  </div>
                  <Badge variant={APPOINTMENT_STATUS_BADGE[apt.status] ?? "secondary"}>
                    {APPOINTMENT_STATUS_LABELS[apt.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
