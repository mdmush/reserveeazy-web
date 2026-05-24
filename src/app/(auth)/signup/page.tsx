import { SignupForm } from "@/components/auth/signup-form";
import { AuthShell } from "@/components/brand/auth-shell";

export default function SignupPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="Start managing appointments in minutes"
      step={{ current: 1, total: 2 }}
    >
      <SignupForm />
    </AuthShell>
  );
}
