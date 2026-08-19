"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  completeProfileSchema,
  type CompleteProfileInput,
} from "@/lib/validations";
import { joinStudioAction } from "@/actions/member";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFocusFirstError,
} from "@/components/ui/form";

export function CompleteProfileForm({
  slug,
  initialName,
}: {
  slug: string;
  initialName: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<CompleteProfileInput>({
    resolver: zodResolver(completeProfileSchema),
    defaultValues: { fullName: initialName, phone: "" },
  });

  useFocusFirstError(form, !!error);

  async function onSubmit(values: CompleteProfileInput) {
    setLoading(true);
    setError(null);
    const result = await joinStudioAction(slug, values);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    router.push(`/portal/${slug}`);
  }

  return (
    <Card className="w-full card-glow">
      <CardContent className="pt-6">
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
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone (optional)</FormLabel>
                  <FormControl>
                    <Input type="tel" autoComplete="tel" placeholder="012-345 6789" {...field} />
                  </FormControl>
                  <FormDescription>
                    The studio uses WhatsApp for reminders and updates
                  </FormDescription>
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
              {loading ? "Joining..." : "Join the studio"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
