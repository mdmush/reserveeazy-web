"use client";

import { useState } from "react";
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
}: {
  widget?: BookingWidget;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
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
      <DialogTrigger>{trigger}</DialogTrigger>
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
            <Button type="submit" className="w-full">
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
}: {
  widget: BookingWidget;
  appUrl: string;
}) {
  const code = buildEmbedCode(appUrl, widget);

  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="outline" size="sm">
          <Code className="h-4 w-4 mr-1.5" aria-hidden />
          Embed code
        </Button>
      </DialogTrigger>
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

function RegenerateTokenButton({ widgetId }: { widgetId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleRegenerate() {
    setLoading(true);
    const result = await regenerateWidgetTokenAction(widgetId);
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Token regenerated. Update the embed code on your site.");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button variant="ghost" size="icon" aria-label="Regenerate token">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Regenerate token?</DialogTitle>
          <DialogDescription>
            Existing embed scripts will stop working until you update them with
            the new token.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleRegenerate} disabled={loading}>
            Regenerate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function WidgetsManager({
  widgets,
  appUrl,
}: {
  widgets: BookingWidget[];
  appUrl: string;
}) {
  const router = useRouter();

  async function handleDelete(id: string) {
    if (!confirm("Delete this widget? Existing embeds will stop working.")) return;
    const result = await deleteWidgetAction(id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  }

  async function handleToggle(id: string, isActive: boolean) {
    const result = await toggleWidgetAction(id, isActive);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  }

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
                <TableHead className="min-w-[220px]" />
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
                    <div className="flex items-center gap-2">
                      <code className="text-xs">{maskToken(widget.public_token)}</code>
                      <CopyButton text={widget.public_token} label="Token" />
                    </div>
                  </TableCell>
                  <TableCell>
                    {widgetPositionLabel(widget.position as WidgetPosition)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={widget.is_active}
                        onCheckedChange={(checked) =>
                          handleToggle(widget.id, checked)
                        }
                        aria-label={`Toggle ${widget.name}`}
                      />
                      <Badge variant={widget.is_active ? "default" : "secondary"}>
                        {widget.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(widget.created_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      <EmbedCodeDialog widget={widget} appUrl={appUrl} />
                      <LinkButton
                        variant="outline"
                        size="sm"
                        href={`/embed/${widget.public_token}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4 mr-1.5" aria-hidden />
                        Preview
                      </LinkButton>
                      <WidgetFormDialog
                        widget={widget}
                        trigger={
                          <Button variant="ghost" size="icon" aria-label="Edit widget">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        }
                      />
                      <RegenerateTokenButton widgetId={widget.id} />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete widget"
                        onClick={() => handleDelete(widget.id)}
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
