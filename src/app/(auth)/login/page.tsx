import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { AuthShell } from "@/components/brand/auth-shell";
import { VerifiedModal } from "@/components/auth/verified-modal";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;
  // Only internal paths survive; loginAction re-validates server-side.
  const redirectTo =
    redirect && redirect.startsWith("/") && !redirect.startsWith("//")
      ? redirect
      : undefined;

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to manage your business">
      <Suspense>
        <VerifiedModal />
      </Suspense>
      <LoginForm redirectTo={redirectTo} />
    </AuthShell>
  );
}
