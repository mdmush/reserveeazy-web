"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeDollarSign, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { setCommissionRateAction } from "@/actions/engine";
import { formatPrice } from "@/lib/format";
import type { ClassType, CommissionRate } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Per-teacher commission rates (RM per attended student): one default rate
 * plus optional per-class-type overrides. Attendance snapshots the rate, so
 * edits here never rewrite history.
 */
export function CommissionRatesDialog({
  teacherId,
  teacherName,
  classTypes,
  rates,
}: {
  teacherId: string;
  teacherName: string;
  classTypes: ClassType[];
  rates: CommissionRate[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const rateFor = (classTypeId: string | null) =>
    rates.find(
      (r) => r.teacher_id === teacherId && r.class_type_id === classTypeId
    );

  const rows: { key: string; label: string; classTypeId: string | null }[] = [
    { key: "default", label: "Default (all class types)", classTypeId: null },
    ...classTypes.map((ct) => ({
      key: ct.id,
      label: ct.name,
      classTypeId: ct.id as string | null,
    })),
  ];

  async function save(row: (typeof rows)[number]) {
    const draft = drafts[row.key];
    if (draft === undefined) return;
    const cents = Math.round(Number(draft) * 100);
    if (!Number.isFinite(cents) || cents < 0) {
      toast.error("Enter a valid rate");
      return;
    }
    setSavingKey(row.key);
    const result = await setCommissionRateAction({
      teacherId,
      classTypeId: row.classTypeId,
      ratePerHeadCents: cents,
    });
    setSavingKey(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`Rate saved for ${row.label}`);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button variant="outline" size="sm" className="w-full justify-start">
          <BadgeDollarSign className="h-4 w-4 mr-2" aria-hidden />
          Commission rates
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Commission — {teacherName}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          RM per attended student. A class-type rate overrides the default;
          attendance records snapshot the rate at the time, so past classes are
          never affected by changes.
        </p>
        <div className="space-y-3">
          {rows.map((row) => {
            const existing = rateFor(row.classTypeId);
            return (
              <div key={row.key} className="flex items-center gap-2">
                <span className="flex-1 text-sm">{row.label}</span>
                <div className="relative w-32">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    RM
                  </span>
                  <Input
                    type="number"
                    step="0.50"
                    min="0"
                    className="pl-10"
                    placeholder={
                      existing
                        ? (existing.rate_per_head_cents / 100).toFixed(2)
                        : "0.00"
                    }
                    value={drafts[row.key] ?? ""}
                    onChange={(e) =>
                      setDrafts((d) => ({ ...d, [row.key]: e.target.value }))
                    }
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={drafts[row.key] === undefined || savingKey === row.key}
                  onClick={() => save(row)}
                >
                  {savingKey === row.key ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Save"
                  )}
                </Button>
                {existing && (
                  <span className="w-20 text-right text-xs text-muted-foreground">
                    now {formatPrice(existing.rate_per_head_cents, "MYR")}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
