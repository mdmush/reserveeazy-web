"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PenLine } from "lucide-react";
import { toast } from "sonner";
import { memberAcceptWaiverAction } from "@/actions/member";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function WaiverSignForm({
  slug,
  clientId,
  signerLabel,
}: {
  slug: string;
  clientId: string;
  signerLabel: string;
}) {
  const router = useRouter();
  const [signature, setSignature] = useState("");
  const [signing, setSigning] = useState(false);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor={`signature-${clientId}`}>{signerLabel}</Label>
        <Input
          id={`signature-${clientId}`}
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          placeholder="Full name"
          autoComplete="name"
        />
      </div>
      <Button
        disabled={!signature.trim() || signing}
        onClick={async () => {
          setSigning(true);
          const result = await memberAcceptWaiverAction({
            slug,
            clientId,
            signatureName: signature,
          });
          setSigning(false);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success("Waiver signed — you're all set to book");
          router.refresh();
        }}
      >
        {signing ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <PenLine className="h-4 w-4 mr-1.5" aria-hidden />
        )}
        I agree and sign
      </Button>
    </div>
  );
}
