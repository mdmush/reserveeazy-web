"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { serviceSchema, type ServiceInput } from "@/lib/validations";
import {
  createServiceAction,
  updateServiceAction,
  deleteServiceAction,
} from "@/actions/dashboard";
import { formatPrice, formatDuration } from "@/lib/format";
import type { Service } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-states";
import { Scissors } from "lucide-react";

function ServiceFormDialog({
  service,
  trigger,
}: {
  service?: Service;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ServiceInput>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: service?.name ?? "",
      description: service?.description ?? "",
      durationMinutes: service?.duration_minutes ?? 30,
      priceCents: service?.price_cents ?? 0,
      isActive: service?.is_active ?? true,
    },
  });

  async function onSubmit(values: ServiceInput) {
    setError(null);
    const result = service
      ? await updateServiceAction(service.id, values)
      : await createServiceAction(values);
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{service ? "Edit service" : "Add service"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <FormField
              control={form.control}
              name="name"
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="durationMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration (min)</FormLabel>
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
                name="priceCents"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price (cents)</FormLabel>
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
            </div>
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <FormLabel>Active</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full">
              {service ? "Save changes" : "Create service"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function ServicesManager({ services }: { services: Service[] }) {
  const router = useRouter();

  async function handleDelete(id: string) {
    if (!confirm("Delete this service?")) return;
    await deleteServiceAction(id);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Services"
        description="Manage what clients can book"
        action={
          <ServiceFormDialog
            trigger={
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add service
              </Button>
            }
          />
        }
      />

      {!services.length ? (
        <EmptyState
          icon={<Scissors className="h-10 w-10" />}
          title="No services yet"
          description="Add your first service so clients can start booking."
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((service) => (
                <TableRow key={service.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{service.name}</p>
                      {service.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {service.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{formatDuration(service.duration_minutes)}</TableCell>
                  <TableCell>{formatPrice(service.price_cents)}</TableCell>
                  <TableCell>
                    <Badge variant={service.is_active ? "default" : "secondary"}>
                      {service.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <ServiceFormDialog
                        service={service}
                        trigger={
                          <Button variant="ghost" size="icon">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(service.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
