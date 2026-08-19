"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { joinRequestSchema, type JoinRequestInput } from "@/lib/validations";
import { sendJoinLinkAction } from "@/actions/member";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFocusFirstError,
} from "@/components/ui/form";

export function JoinForm({
  slug,
  studioName,
}: {
  slug: string;
  studioName: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<JoinRequestInput>({
    resolver: zodResolver(joinRequestSchema),
    defaultValues: { fullName: "", email: "" },
  });

  useFocusFirstError(form, !!error);

  async function onSubmit(values: JoinRequestInput) {
    setLoading(true);
    setError(null);
    const result = await sendJoinLinkAction(slug, values);
    setLoading(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setSent(true);
  }

  return (
    <Card className="w-full card-glow">
      <CardContent className="pt-6">
        {sent ? (
          <Alert role="status">
            <MailCheck className="h-4 w-4" aria-hidden />
            <AlertDescription>
              Check your email — tap the link inside to finish joining{" "}
              {studioName}. The link works for 10 minutes.
            </AlertDescription>
          </Alert>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <Alert variant="destructive" role="alert" tabIndex={-1}>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your name</FormLabel>
                    <FormControl>
                      <Input autoComplete="name" {...field} />
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
              <Button
                type="submit"
                className="w-full"
                disabled={loading}
                aria-busy={loading}
              >
                {loading ? "Sending..." : "Send me a join link"}
              </Button>
              <p className="text-xs text-muted-foreground">
                No password needed — we&apos;ll email you a secure link.
              </p>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}
