"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { clientSchema, type ClientInput } from "@/lib/validations";
import { createClientAction } from "@/actions/dashboard";
import type { Client } from "@/types/database";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { UserCircle } from "lucide-react";

function ClientFormDialog({ trigger }: { trigger: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const form = useForm<ClientInput>({
    resolver: zodResolver(clientSchema),
    defaultValues: { fullName: "", email: "", phone: "", notes: "" },
  });

  async function onSubmit(values: ClientInput) {
    const result = await createClientAction(values);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Client added");
    setOpen(false);
    form.reset();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add client</DialogTitle>
        </DialogHeader>
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
            <Button
              type="submit"
              className="w-full"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              )}
              Add client
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function ClientsList({ clients }: { clients: Client[] }) {
  const [query, setQuery] = useState("");

  const filtered = clients.filter(
    (c) =>
      c.full_name.toLowerCase().includes(query.toLowerCase()) ||
      c.email?.toLowerCase().includes(query.toLowerCase()) ||
      c.phone?.includes(query)
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="Manage your client base"
        action={
          <ClientFormDialog
            trigger={
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add client
              </Button>
            }
          />
        }
      />

      {clients.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}

      {!clients.length ? (
        <EmptyState
          icon={<UserCircle className="h-10 w-10" />}
          title="No clients yet"
          description="Clients are added automatically when they book online, or you can add them manually."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.full_name}</TableCell>
                  <TableCell>{client.email ?? "—"}</TableCell>
                  <TableCell>{client.phone ?? "—"}</TableCell>
                  <TableCell>
                    <LinkButton variant="ghost" size="sm" href={`/dashboard/clients/${client.id}`}>
                      View
                    </LinkButton>
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
