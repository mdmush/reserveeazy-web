"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2, Loader2, Package as PackageIcon, Receipt } from "lucide-react";
import { toast } from "sonner";
import {
  packageSchema,
  assignPackageSchema,
  type PackageInput,
  type AssignPackageInput,
} from "@/lib/validations";
import {
  createPackageAction,
  updatePackageAction,
  deletePackageAction,
  assignPackageAction,
} from "@/actions/engine";
import { formatPrice } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/payments";
import type { ClassType, Package } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

type ClientOption = { id: string; full_name: string };

function currencyField(
  value: number,
  onChange: (cents: number) => void
) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
        RM
      </span>
      <Input
        type="number"
        step="0.01"
        min="0"
        className="pl-10"
        value={Number.isFinite(value) ? value / 100 : ""}
        onChange={(e) => onChange(Math.round(Number(e.target.value) * 100))}
      />
    </div>
  );
}

function PackageFormDialog({
  pkg,
  classTypes,
  trigger,
}: {
  pkg?: Package;
  classTypes: ClassType[];
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const form = useForm<PackageInput>({
    resolver: zodResolver(packageSchema),
    defaultValues: {
      name: pkg?.name ?? "",
      scope: pkg?.scope ?? "locked",
      classTypeId: pkg?.class_type_id ?? "",
      creditCount: pkg?.credit_count ?? 4,
      validityDays: pkg?.validity_days ?? 30,
      expiryTrigger: pkg?.expiry_trigger ?? "first_attendance",
      priceCents: pkg?.price_cents ?? 0,
      isActive: pkg?.is_active ?? true,
    },
  });

  const scope = form.watch("scope");

  async function onSubmit(values: PackageInput) {
    const result = pkg
      ? await updatePackageAction(pkg.id, values)
      : await createPackageAction(values);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(pkg ? "Package saved" : "Package created");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{pkg ? "Edit package" : "Add package"}</DialogTitle>
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
                    <Input placeholder="Aeroyoga 8" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="scope"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Scope</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="locked">
                          Locked to one class type
                        </SelectItem>
                        <SelectItem value="flexible">
                          Flexible (any class type)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {scope === "locked" && (
                <FormField
                  control={form.control}
                  name="classTypeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Class type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value ?? ""}
                      >
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
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="creditCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Credits</FormLabel>
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
                name="validityDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Validity (days)</FormLabel>
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
                name="expiryTrigger"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Validity starts</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="first_attendance">
                          On first attendance
                        </SelectItem>
                        <SelectItem value="purchase">On purchase</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="priceCents"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price</FormLabel>
                    <FormControl>
                      {currencyField(field.value, field.onChange)}
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
              {pkg ? "Save changes" : "Create package"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function AssignPackageDialog({
  packages,
  clients,
  presetClientId,
  trigger,
}: {
  packages: Package[];
  clients: ClientOption[];
  presetClientId?: string;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const form = useForm<AssignPackageInput>({
    resolver: zodResolver(assignPackageSchema),
    defaultValues: {
      clientId: presetClientId ?? "",
      packageId: "",
      amountCents: 0,
      method: "cash",
      notes: "",
    },
  });

  function onPackageChange(id: string | null) {
    if (!id) return;
    form.setValue("packageId", id);
    const pkg = packages.find((p) => p.id === id);
    if (pkg) form.setValue("amountCents", pkg.price_cents);
  }

  async function onSubmit(values: AssignPackageInput) {
    const result = await assignPackageAction(values);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(
      result.receiptNumber
        ? `Package assigned — receipt ${result.receiptNumber}`
        : "Package assigned"
    );
    setOpen(false);
    form.reset();
    router.refresh();
  }

  const activePackages = packages.filter((p) => p.is_active);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sell a package</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {!presetClientId && (
              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Member</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pick a member" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="packageId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Package</FormLabel>
                  <Select onValueChange={onPackageChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pick a package" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {activePackages.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} · {p.credit_count} credits ·{" "}
                          {formatPrice(p.price_cents, "MYR")}
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
                name="amountCents"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount paid</FormLabel>
                    <FormControl>
                      {currencyField(field.value, field.onChange)}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment method</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PAYMENT_METHODS.map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormDescription>
              Records the payment and issues a numbered digital receipt in one
              step.
            </FormDescription>
            <Button
              type="submit"
              className="w-full"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              )}
              Sell package
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function PackagesManager({
  packages,
  classTypes,
  clients,
}: {
  packages: Package[];
  classTypes: ClassType[];
  clients: ClientOption[];
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<Package | null>(null);
  const classTypeName = (id: string | null) =>
    classTypes.find((ct) => ct.id === id)?.name ?? "—";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Packages"
        description="Credit packages: locked tiers and flexible credit pools"
        action={
          <div className="flex gap-2">
            <AssignPackageDialog
              packages={packages}
              clients={clients}
              trigger={
                <Button variant="outline">
                  <Receipt className="h-4 w-4 mr-2" />
                  Sell package
                </Button>
              }
            />
            <PackageFormDialog
              classTypes={classTypes}
              trigger={
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add package
                </Button>
              }
            />
          </div>
        }
      />

      {!packages.length ? (
        <EmptyState
          icon={<PackageIcon className="h-10 w-10" />}
          title="No packages yet"
          description="Create locked packages (e.g. Aeroyoga 4) and flexible credit tiers (30/50/100)."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Credits</TableHead>
                <TableHead>Validity</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {packages.map((pkg) => (
                <TableRow key={pkg.id}>
                  <TableCell className="font-medium">{pkg.name}</TableCell>
                  <TableCell>
                    {pkg.scope === "locked" ? (
                      <Badge variant="secondary">
                        {classTypeName(pkg.class_type_id)} only
                      </Badge>
                    ) : (
                      <Badge variant="success">Flexible</Badge>
                    )}
                  </TableCell>
                  <TableCell>{pkg.credit_count}</TableCell>
                  <TableCell>
                    {pkg.validity_days} days
                    <span className="block text-xs text-muted-foreground">
                      {pkg.expiry_trigger === "first_attendance"
                        ? "from first attendance"
                        : "from purchase"}
                    </span>
                  </TableCell>
                  <TableCell>{formatPrice(pkg.price_cents, "MYR")}</TableCell>
                  <TableCell>
                    <Badge variant={pkg.is_active ? "success" : "secondary"}>
                      {pkg.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <PackageFormDialog
                        pkg={pkg}
                        classTypes={classTypes}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Edit ${pkg.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${pkg.name}`}
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleting(pkg)}
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
        title="Delete package?"
        description={
          deleting
            ? `This permanently removes “${deleting.name}”. Packages already sold to members cannot be deleted — deactivate instead.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          const result = await deletePackageAction(deleting.id);
          if (result?.error) return { error: result.error };
          toast.success("Package deleted");
          router.refresh();
        }}
      />
    </div>
  );
}
