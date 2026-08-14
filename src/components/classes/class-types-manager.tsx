"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { classTypeSchema, type ClassTypeInput } from "@/lib/validations";
import {
  createClassTypeAction,
  updateClassTypeAction,
  deleteClassTypeAction,
} from "@/actions/classes";
import { formatPrice, formatDuration } from "@/lib/format";
import type { ClassType } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
  FormDescription,
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

function ClassTypeFormDialog({
  classType,
  trigger,
}: {
  classType?: ClassType;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const form = useForm<ClassTypeInput>({
    resolver: zodResolver(classTypeSchema),
    defaultValues: {
      name: classType?.name ?? "",
      description: classType?.description ?? "",
      color: classType?.color ?? "",
      defaultDurationMinutes: classType?.default_duration_minutes ?? 60,
      defaultCapacity: classType?.default_capacity ?? 10,
      creditCost: classType?.credit_cost ?? 10,
      dropInPriceCents: classType?.drop_in_price_cents ?? 0,
      isActive: classType?.is_active ?? true,
    },
  });

  async function onSubmit(values: ClassTypeInput) {
    const result = classType
      ? await updateClassTypeAction(classType.id, values)
      : await createClassTypeAction(values);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(classType ? "Class type saved" : "Class type created");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {classType ? "Edit class type" : "Add class type"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Aeroyoga" {...field} />
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
                name="defaultDurationMinutes"
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
                name="defaultCapacity"
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
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="creditCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Credit cost</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      Credits used from flexible tiers (locked packages always
                      use 1)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dropInPriceCents"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Drop-in price</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                          RM
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="pl-10"
                          value={
                            Number.isFinite(field.value) ? field.value / 100 : ""
                          }
                          onChange={(e) =>
                            field.onChange(
                              Math.round(Number(e.target.value) * 100)
                            )
                          }
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      Charged per attendance in pay-per-class mode
                    </FormDescription>
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
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="w-full"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              )}
              {classType ? "Save changes" : "Create class type"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function ClassTypesManager({ classTypes }: { classTypes: ClassType[] }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<ClassType | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Classes"
        description="Class types, credit costs, and drop-in prices"
        action={
          <ClassTypeFormDialog
            trigger={
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add class type
              </Button>
            }
          />
        }
      />

      {!classTypes.length ? (
        <EmptyState
          icon={<Sparkles className="h-10 w-10" />}
          title="No class types yet"
          description="Add class types like Ballet, Yoga, or Aeroyoga to start scheduling sessions."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Credit cost</TableHead>
                <TableHead>Drop-in</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {classTypes.map((classType) => (
                <TableRow key={classType.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{classType.name}</p>
                      {classType.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {classType.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {formatDuration(classType.default_duration_minutes)}
                  </TableCell>
                  <TableCell>{classType.default_capacity}</TableCell>
                  <TableCell>{classType.credit_cost} credits</TableCell>
                  <TableCell>
                    {classType.drop_in_price_cents > 0
                      ? formatPrice(classType.drop_in_price_cents, "MYR")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={classType.is_active ? "success" : "secondary"}
                    >
                      {classType.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <ClassTypeFormDialog
                        classType={classType}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Edit ${classType.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${classType.name}`}
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleting(classType)}
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

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Delete class type?"
        description={
          deleting
            ? `This permanently removes “${deleting.name}”. Class types with scheduled sessions cannot be deleted — deactivate instead.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          const result = await deleteClassTypeAction(deleting.id);
          if (result?.error) return { error: result.error };
          toast.success("Class type deleted");
          router.refresh();
        }}
      />
    </div>
  );
}
