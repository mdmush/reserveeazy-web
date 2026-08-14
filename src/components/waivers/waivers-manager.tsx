"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, FileCheck, Loader2, ScrollText } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { toast } from "sonner";
import {
  createWaiverVersionAction,
  updateWaiverDraftAction,
  publishWaiverVersionAction,
} from "@/actions/waivers";
import type { WaiverVersion } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-states";

function WaiverEditorDialog({
  waiver,
  open,
  onOpenChange,
}: {
  waiver: WaiverVersion | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(waiver?.title ?? "");
  const [body, setBody] = useState(waiver?.body ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const result = waiver
      ? await updateWaiverDraftAction({ id: waiver.id, title, body })
      : await createWaiverVersionAction({ title, body });
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(waiver ? "Draft saved" : "Draft created");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {waiver ? `Edit draft v${waiver.version}` : "New waiver version"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="waiver-title">Title</Label>
            <Input
              id="waiver-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Liability waiver"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="waiver-body">Waiver text</Label>
            <Textarea
              id="waiver-body"
              rows={12}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <Button
            className="w-full"
            disabled={!title.trim() || !body.trim() || saving}
            onClick={handleSave}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Save draft
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function WaiversManager({
  versions,
  timezone,
}: {
  versions: WaiverVersion[];
  timezone: string;
}) {
  const router = useRouter();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<WaiverVersion | null>(null);
  const [publishing, setPublishing] = useState<WaiverVersion | null>(null);

  const current = versions.find((v) => v.published_at);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Waivers"
        description="Versioned liability waiver — members must accept the current version before booking"
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setEditorOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            New version
          </Button>
        }
      />

      {!versions.length ? (
        <EmptyState
          icon={<ScrollText className="h-10 w-10" />}
          title="No waiver yet"
          description="Draft your liability waiver. Bookings are only gated once a version is published."
        />
      ) : (
        <div className="space-y-4">
          {versions.map((version) => (
            <Card key={version.id}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">
                  v{version.version} — {version.title}
                  {version.published_at ? (
                    <Badge
                      variant={current?.id === version.id ? "success" : "secondary"}
                      className="ml-2"
                    >
                      {current?.id === version.id ? "Current" : "Superseded"}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="ml-2">
                      Draft
                    </Badge>
                  )}
                </CardTitle>
                <div className="flex gap-1">
                  {!version.published_at && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit draft v${version.version}`}
                        onClick={() => {
                          setEditing(version);
                          setEditorOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPublishing(version)}
                      >
                        <FileCheck className="h-4 w-4 mr-1.5" aria-hidden />
                        Publish
                      </Button>
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground line-clamp-4">
                  {version.body}
                </p>
                {version.published_at && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Published{" "}
                    {formatInTimeZone(version.published_at, timezone, "d MMM yyyy")}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editorOpen && (
        <WaiverEditorDialog
          key={editing?.id ?? "new"}
          waiver={editing}
          open={editorOpen}
          onOpenChange={setEditorOpen}
        />
      )}

      <ConfirmDialog
        open={!!publishing}
        onOpenChange={(open) => {
          if (!open) setPublishing(null);
        }}
        title={`Publish waiver v${publishing?.version}?`}
        description="Publishing makes this the current waiver. Every member (and every dependent, via their guardian) must accept it before their next booking."
        confirmLabel="Publish"
        onConfirm={async () => {
          if (!publishing) return;
          const result = await publishWaiverVersionAction(publishing.id);
          if (result?.error) return { error: result.error };
          toast.success("Waiver published — acceptance now required");
          router.refresh();
        }}
      />
    </div>
  );
}
