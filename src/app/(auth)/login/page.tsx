import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { AuthShell } from "@/components/brand/auth-shell";
import { VerifiedModal } from "@/components/auth/verified-modal";

export default function LoginPage() {
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to manage your business">
      <Suspense>
        <VerifiedModal />
      </Suspense>
      <LoginForm />
    </AuthShell>
  );
}
