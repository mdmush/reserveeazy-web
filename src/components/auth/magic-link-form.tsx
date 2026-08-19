"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { magicLinkSchema, type MagicLinkInput } from "@/lib/validations";
import { sendMagicLinkAction } from "@/actions/member";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFocusFirstError,
} from "@/components/ui/form";

export function MagicLinkForm() {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<MagicLinkInput>({
    resolver: zodResolver(magicLinkSchema),
    defaultValues: { email: "" },
  });

  useFocusFirstError(form, !!error);

  async function onSubmit(values: MagicLinkInput) {
    setLoading(true);
    setError(null);
    const result = await sendMagicLinkAction(values);
    setLoading(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <Alert role="status">
        <MailCheck className="h-4 w-4" aria-hidden />
        <AlertDescription>
          If that email has an account, a sign-in link is on its way. Check
          your inbox — the link works for 10 minutes.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <Alert variant="destructive" role="alert" tabIndex={-1}>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={loading} aria-busy={loading}>
          {loading ? "Sending..." : "Email me a sign-in link"}
        </Button>
      </form>
    </Form>
  );
}
