import { SignupForm } from "@/components/auth/signup-form";
import { AuthShell } from "@/components/brand/auth-shell";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  return (
    <AuthShell
      title="Create your account"
      subtitle="Start managing appointments in minutes"
      step={{ current: 1, total: 2 }}
    >
      <SignupForm initialEmail={email ?? ""} />
    </AuthShell>
  );
}
