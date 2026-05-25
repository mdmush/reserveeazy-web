"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function VerifiedModal() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isVerified = searchParams.get("verified") === "true";

  function handleClose() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("verified");
    const qs = params.toString();
    router.replace(`/login${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  return (
    <Dialog open={isVerified} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent showCloseButton={false} className="sm:max-w-sm">
        <DialogHeader className="items-center text-center">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle2 className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-xl">You&apos;re verified!</DialogTitle>
          <DialogDescription>
            Your email has been confirmed successfully. Sign in below to get
            started.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          <Button className="w-full" onClick={handleClose}>
            Continue to sign in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
