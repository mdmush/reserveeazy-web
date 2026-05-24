import { OnboardingForm } from "@/components/auth/onboarding-form";
import { AuthShell } from "@/components/brand/auth-shell";

export default function OnboardingPage() {
  return (
    <AuthShell
      title="Set up your business"
      subtitle="Tell us about your business to get started"
      step={{ current: 2, total: 2 }}
    >
      <OnboardingForm />
    </AuthShell>
  );
}
