"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Plus,
  Pencil,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  Eye,
  MoreHorizontal,
  RefreshCw,
  Code,
} from "lucide-react";
import { toast } from "sonner";
import { widgetSchema, type WidgetInput } from "@/lib/validations";
import {
  createWidgetAction,
  updateWidgetAction,
  deleteWidgetAction,
  toggleWidgetAction,
  regenerateWidgetTokenAction,
} from "@/actions/widgets";
import {
  WIDGET_POSITIONS,
  widgetPositionLabel,
  widgetPositionToScript,
} from "@/lib/constants";
import type { BookingWidget, WidgetPosition } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
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
import { LinkButton } from "@/components/ui/link-button";
import { format } from "date-fns";

function maskToken(token: string) {
  if (token.length <= 12) return token;
  return `${token.slice(0, 6)}…${token.slice(-4)}`;
}

function buildEmbedCode(
  appUrl: string,
  widget: Pick<
    BookingWidget,
    "public_token" | "position" | "button_label"
  >
) {
  const position = widgetPositionToScript(widget.position);
  return `<script
  src="${appUrl}/widget.js"
  data-token="${widget.public_token}"
  data-position="${position}"
  data-label="${widget.button_label}"
  defer
></script>`;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(`${label} copied`);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button variant="outline" size="sm" onClick={handleCopy}>
      {copied ? (
        <Check className="h-4 w-4 mr-1.5" aria-hidden />
      ) : (
        <Copy className="h-4 w-4 mr-1.5" aria-hidden />
      )}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

function WidgetFormDialog({
  widget,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  widget?: BookingWidget;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const [error, setError] = useState<string | null>(null);

  const form = useForm<WidgetInput>({
    resolver: zodResolver(widgetSchema),
    defaultValues: {
      name: widget?.name ?? "",
      position: widget?.position ?? "bottom_right",
      buttonLabel: widget?.button_label ?? "Book now",
      allowedDomains: widget?.allowed_domains?.join(", ") ?? "",
    },
  });

  async function onSubmit(values: WidgetInput) {
    setError(null);
    const result = widget
      ? await updateWidgetAction(widget.id, values)
      : await createWidgetAction(values);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{widget ? "Edit widget" : "Create widget"}</DialogTitle>
          <DialogDescription>
            Configure a floating booking button for your website.
          </DialogDescription>
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
                    <Input placeholder="Website footer widget" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="position"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Button position</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select position" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {WIDGET_POSITIONS.map((pos) => (
                        <SelectItem key={pos.value} value={pos.value}>
                          {pos.label}
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
              name="buttonLabel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Button label</FormLabel>
                  <FormControl>
                    <Input placeholder="Book now" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="allowedDomains"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Allowed domains (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="example.com, www.example.com"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Comma-separated. Leave empty to allow all domains.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="w-full"
              disabled={form.formState.isSubmitting}
            >
              {widget ? "Save changes" : "Create widget"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function EmbedCodeDialog({
  widget,
  appUrl,
  open,
  onOpenChange,
}: {
  widget: BookingWidget;
  appUrl: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const code = buildEmbedCode(appUrl, widget);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Embed code</DialogTitle>
          <DialogDescription>
            Paste this snippet before the closing{" "}
            <code className="text-xs">&lt;/body&gt;</code> tag on your site.
          </DialogDescription>
        </DialogHeader>
        <pre className="rounded-lg bg-muted p-4 text-xs overflow-x-auto whitespace-pre-wrap break-all">
          {code}
        </pre>
        <DialogFooter className="gap-2 sm:gap-0">
          <CopyButton text={code} label="Embed code" />
          <LinkButton
            variant="outline"
            size="sm"
            href={`/embed-demo?token=${widget.public_token}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="h-4 w-4 mr-1.5" aria-hidden />
            View demo
          </LinkButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WidgetActiveSwitch({ widget }: { widget: BookingWidget }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleToggle(checked: boolean) {
    startTransition(async () => {
      const result = await toggleWidgetAction(widget.id, checked);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Switch
      checked={widget.is_active}
      disabled={pending}
      onCheckedChange={handleToggle}
      aria-label={`Toggle ${widget.name}`}
    />
  );
}

function WidgetRowActions({
  widget,
  appUrl,
}: {
  widget: BookingWidget;
  appUrl: string;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function handleCopyToken() {
    await navigator.clipboard.writeText(widget.public_token);
    toast.success("Token copied");
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" aria-label="Widget actions" />
          }
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil aria-hidden />
            Edit widget
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCopyToken}>
            <Copy aria-hidden />
            Copy token
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setEmbedOpen(true)}>
            <Code aria-hidden />
            Embed code
          </DropdownMenuItem>
          <DropdownMenuItem
            render={
              <a
                href={`/embed-demo?token=${widget.public_token}`}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            <ExternalLink aria-hidden />
            View demo
          </DropdownMenuItem>
          <DropdownMenuItem
            render={
              <a
                href={`/embed/${widget.public_token}`}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            <Eye aria-hidden />
            Preview
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setRegenerateOpen(true)}>
            <RefreshCw aria-hidden />
            Regenerate token
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 aria-hidden />
            Delete widget
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <WidgetFormDialog
        widget={widget}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <EmbedCodeDialog
        widget={widget}
        appUrl={appUrl}
        open={embedOpen}
        onOpenChange={setEmbedOpen}
      />
      <ConfirmDialog
        open={regenerateOpen}
        onOpenChange={setRegenerateOpen}
        title="Regenerate token?"
        description="Existing embed scripts will stop working until you update them with the new token."
        confirmLabel="Regenerate"
        destructive
        onConfirm={async () => {
          const result = await regenerateWidgetTokenAction(widget.id);
          if (result.error) return { error: result.error };
          toast.success("Token regenerated. Update the embed code on your site.");
          router.refresh();
        }}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete widget?"
        description="Existing embeds will stop working immediately."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          const result = await deleteWidgetAction(widget.id);
          if (result.error) return { error: result.error };
          toast.success("Widget deleted");
          router.refresh();
        }}
      />
    </>
  );
}

export function WidgetsManager({
  widgets,
  appUrl,
}: {
  widgets: BookingWidget[];
  appUrl: string;
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Widgets"
        description="Embed a floating booking button on your website"
        action={
          <WidgetFormDialog
            trigger={
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create widget
              </Button>
            }
          />
        }
      />

      {!widgets.length ? (
        <EmptyState
          icon={<Code className="h-10 w-10" />}
          title="No widgets yet"
          description="Create a widget to get a copy-paste script for your website."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Token</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-12 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {widgets.map((widget) => (
                <TableRow key={widget.id}>
                  <TableCell>
                    <p className="font-medium">{widget.name}</p>
                    {widget.allowed_domains.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Domains: {widget.allowed_domains.join(", ")}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <code className="text-xs">{maskToken(widget.public_token)}</code>
                  </TableCell>
                  <TableCell>
                    {widgetPositionLabel(widget.position as WidgetPosition)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <WidgetActiveSwitch widget={widget} />
                      <Badge variant={widget.is_active ? "default" : "secondary"}>
                        {widget.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(widget.created_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <WidgetRowActions widget={widget} appUrl={appUrl} />
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
