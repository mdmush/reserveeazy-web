"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2, Clock } from "lucide-react";
import { staffSchema, type StaffInput } from "@/lib/validations";
import {
  createStaffAction,
  updateStaffAction,
  deleteStaffAction,
  addAvailabilityAction,
  deleteAvailabilityAction,
} from "@/actions/dashboard";
import { DAYS_OF_WEEK } from "@/lib/constants";
import type { BusinessMember, Service, StaffAvailability } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-states";
import { Users } from "lucide-react";

type StaffWithRelations = BusinessMember & {
  staff_services: { service_id: string }[];
  staff_availability: StaffAvailability[];
};

function StaffFormDialog({
  staff,
  services,
  trigger,
}: {
  staff?: StaffWithRelations;
  services: Service[];
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<StaffInput>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      displayName: staff?.display_name ?? "",
      email: staff?.email ?? "",
      role: staff?.role === "owner" ? "admin" : (staff?.role as "admin" | "staff") ?? "staff",
      isBookable: staff?.is_bookable ?? true,
      serviceIds: staff?.staff_services?.map((s) => s.service_id) ?? [],
    },
  });

  async function onSubmit(values: StaffInput) {
    setError(null);
    const result = staff
      ? await updateStaffAction(staff.id, values)
      : await createStaffAction(values);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{staff ? "Edit staff" : "Add staff"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
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
                  <FormLabel>Email (optional)</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {staff?.role !== "owner" && (
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="staff">Staff</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="isBookable"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <FormLabel>Available for booking</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            {services.length > 0 && (
              <FormField
                control={form.control}
                name="serviceIds"
                render={() => (
                  <FormItem>
                    <FormLabel>Services</FormLabel>
                    <div className="space-y-2">
                      {services.map((service) => (
                        <FormField
                          key={service.id}
                          control={form.control}
                          name="serviceIds"
                          render={({ field }) => (
                            <FormItem className="flex items-center gap-2">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(service.id)}
                                  onCheckedChange={(checked) => {
                                    const current = field.value ?? [];
                                    field.onChange(
                                      checked
                                        ? [...current, service.id]
                                        : current.filter((id) => id !== service.id)
                                    );
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="font-normal">{service.name}</FormLabel>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                  </FormItem>
                )}
              />
            )}
            <Button type="submit" className="w-full">
              {staff ? "Save changes" : "Add staff member"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function AvailabilityDialog({ staff }: { staff: StaffWithRelations }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    setError(null);
    const result = await addAvailabilityAction(staff.id, {
      dayOfWeek: parseInt(dayOfWeek),
      startTime,
      endTime,
    });
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleDelete(id: string) {
    await deleteAvailabilityAction(id);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button variant="outline" size="sm">
          <Clock className="h-4 w-4 mr-2" />
          Availability
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Availability · {staff.display_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {staff.staff_availability?.length ? (
            <ul className="space-y-2">
              {staff.staff_availability.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between rounded-lg border p-2 text-sm"
                >
                  <span>
                    {DAYS_OF_WEEK[a.day_of_week]} · {a.start_time.slice(0, 5)} –{" "}
                    {a.end_time.slice(0, 5)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(a.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No availability set yet.</p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
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
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
          <Button onClick={handleAdd} className="w-full">
            Add hours
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function StaffManager({
  staff,
  services,
}: {
  staff: StaffWithRelations[];
  services: Service[];
}) {
  const router = useRouter();

  async function handleDelete(id: string, role: string) {
    if (role === "owner") return;
    if (!confirm("Remove this staff member?")) return;
    await deleteStaffAction(id);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff"
        description="Manage team members and availability"
        action={
          <StaffFormDialog
            services={services}
            trigger={
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add staff
              </Button>
            }
          />
        }
      />

      {!staff.length ? (
        <EmptyState
          icon={<Users className="h-10 w-10" />}
          title="No staff yet"
          description="Add team members and set their weekly availability."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {staff.map((member) => (
            <Card key={member.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">{member.display_name}</CardTitle>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="secondary">{member.role}</Badge>
                    {member.is_bookable && (
                      <Badge variant="outline">Bookable</Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <StaffFormDialog
                    staff={member}
                    services={services}
                    trigger={
                      <Button variant="ghost" size="icon">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    }
                  />
                  {member.role !== "owner" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(member.id, member.role)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {member.email && (
                  <p className="text-sm text-muted-foreground">{member.email}</p>
                )}
                <AvailabilityDialog staff={member} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
