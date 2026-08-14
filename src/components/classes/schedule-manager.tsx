"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { addDays, format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import {
  Plus,
  Loader2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { classSessionSchema, type ClassSessionInput } from "@/lib/validations";
import {
  createClassSessionsAction,
  cancelClassSessionAction,
} from "@/actions/classes";
import type { ClassSession, ClassType } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/link-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
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
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-states";

export type SessionWithRelations = ClassSession & {
  class_types: { name: string; color: string | null } | null;
  business_members: { display_name: string } | null;
};

type TeacherOption = { id: string; display_name: string };

function SessionFormDialog({
  classTypes,
  teachers,
  defaultDate,
  trigger,
}: {
  classTypes: ClassType[];
  teachers: TeacherOption[];
  defaultDate: string;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const form = useForm<ClassSessionInput>({
    resolver: zodResolver(classSessionSchema),
    defaultValues: {
      classTypeId: classTypes[0]?.id ?? "",
      teacherId: teachers[0]?.id ?? "",
      date: defaultDate,
      startTime: "10:00",
      durationMinutes: classTypes[0]?.default_duration_minutes ?? 60,
      capacity: classTypes[0]?.default_capacity ?? 10,
      room: "",
      notes: "",
      repeatWeekly: false,
      repeatUntil: "",
    },
  });

  const repeatWeekly = form.watch("repeatWeekly");

  function onClassTypeChange(id: string | null) {
    if (!id) return;
    form.setValue("classTypeId", id);
    const classType = classTypes.find((ct) => ct.id === id);
    if (classType) {
      form.setValue("durationMinutes", classType.default_duration_minutes);
      form.setValue("capacity", classType.default_capacity);
    }
  }

  async function onSubmit(values: ClassSessionInput) {
    const result = await createClassSessionsAction(values);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(
      result.count && result.count > 1
        ? `${result.count} sessions scheduled`
        : "Session scheduled"
    );
    setOpen(false);
    form.reset();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule a class</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="classTypeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Class type</FormLabel>
                  <Select onValueChange={onClassTypeChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pick a class type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {classTypes.map((ct) => (
                        <SelectItem key={ct.id} value={ct.id}>
                          {ct.name}
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
              name="teacherId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Teacher</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pick a teacher" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {teachers.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.display_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="durationMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration</FormLabel>
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
                name="capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Capacity</FormLabel>
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
                name="room"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Room</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="repeatWeekly"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <FormLabel>Repeat weekly</FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            {repeatWeekly && (
              <FormField
                control={form.control}
                name="repeatUntil"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Repeat until</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              )}
              Schedule
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function ScheduleManager({
  sessions,
  classTypes,
  teachers,
  weekStart,
  weekDays,
  todayLocal,
  timezone,
}: {
  sessions: SessionWithRelations[];
  classTypes: ClassType[];
  teachers: TeacherOption[];
  weekStart: string;
  weekDays: string[];
  todayLocal: string;
  timezone: string;
}) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState<SessionWithRelations | null>(
    null
  );

  const prevWeek = format(addDays(parseISO(weekStart), -7), "yyyy-MM-dd");
  const nextWeek = format(addDays(parseISO(weekStart), 7), "yyyy-MM-dd");
  const sessionsByDay = new Map<string, SessionWithRelations[]>();
  for (const session of sessions) {
    const day = formatInTimeZone(session.start_at, timezone, "yyyy-MM-dd");
    sessionsByDay.set(day, [...(sessionsByDay.get(day) ?? []), session]);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedule"
        description="Weekly class sessions"
        action={
          classTypes.length > 0 && teachers.length > 0 ? (
            <SessionFormDialog
              classTypes={classTypes}
              teachers={teachers}
              defaultDate={todayLocal}
              trigger={
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Schedule class
                </Button>
              }
            />
          ) : undefined
        }
      />

      <div className="flex items-center gap-2">
        <LinkButton
          variant="outline"
          size="sm"
          href={`/dashboard/schedule?week=${prevWeek}`}
          aria-label="Previous week"
        >
          <ChevronLeft className="h-4 w-4" />
        </LinkButton>
        <span className="px-2 text-sm font-semibold">
          {format(parseISO(weekStart), "d MMM")} –{" "}
          {format(addDays(parseISO(weekStart), 6), "d MMM yyyy")}
        </span>
        <LinkButton
          variant="outline"
          size="sm"
          href={`/dashboard/schedule?week=${nextWeek}`}
          aria-label="Next week"
        >
          <ChevronRight className="h-4 w-4" />
        </LinkButton>
      </div>

      {classTypes.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-10 w-10" />}
          title="Add a class type first"
          description="Sessions are scheduled from your class types."
          action={{ label: "Manage classes", href: "/dashboard/classes" }}
        />
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-10 w-10" />}
          title="Nothing scheduled this week"
          description="Schedule a class — weekly repeats fill the whole term in one go."
        />
      ) : (
        <div className="space-y-4">
          {weekDays.map((day) => {
            const daySessions = sessionsByDay.get(day) ?? [];
            if (!daySessions.length) return null;
            return (
              <div key={day} className="space-y-2">
                <h2 className="text-sm font-semibold text-muted-foreground">
                  {format(parseISO(day), "EEEE d MMM")}
                  {day === todayLocal && (
                    <Badge className="ml-2" variant="success">
                      Today
                    </Badge>
                  )}
                </h2>
                <div className="grid gap-2">
                  {daySessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between rounded-2xl border bg-card p-4 shadow-soft"
                    >
                      <Link
                        href={`/dashboard/schedule/${session.id}`}
                        className="flex-1 min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold">
                              {session.class_types?.name ?? "Class"}
                              {session.status === "cancelled" && (
                                <Badge variant="secondary" className="ml-2">
                                  Cancelled
                                </Badge>
                              )}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {formatInTimeZone(session.start_at, timezone, "h:mm a")}
                              {" – "}
                              {formatInTimeZone(session.end_at, timezone, "h:mm a")}
                              {" · "}
                              {session.business_members?.display_name}
                              {session.room ? ` · ${session.room}` : ""}
                            </p>
                          </div>
                        </div>
                      </Link>
                      <div className="flex items-center gap-3 pl-3">
                        <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                          <Users className="h-4 w-4" aria-hidden />
                          {session.capacity}
                        </span>
                        {session.status === "scheduled" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Cancel session"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => setCancelling(session)}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!cancelling}
        onOpenChange={(open) => {
          if (!open) setCancelling(null);
        }}
        title="Cancel this session?"
        description={
          cancelling
            ? `${cancelling.class_types?.name ?? "Class"} on ${formatInTimeZone(
                cancelling.start_at,
                timezone,
                "EEE d MMM, h:mm a"
              )} will be marked cancelled.`
            : undefined
        }
        confirmLabel="Cancel session"
        destructive
        onConfirm={async () => {
          if (!cancelling) return;
          const result = await cancelClassSessionAction(cancelling.id);
          if (result?.error) return { error: result.error };
          toast.success("Session cancelled");
          router.refresh();
        }}
      />
    </div>
  );
}
