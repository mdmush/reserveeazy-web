import { LoginForm } from "@/components/auth/login-form";
import { AuthShell } from "@/components/brand/auth-shell";

export default function LoginPage() {
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to manage your business">
      <LoginForm />
    </AuthShell>
  );
}
