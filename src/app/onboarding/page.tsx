import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/auth/onboarding-form";
import { AuthShell } from "@/components/brand/auth-shell";
import { getIsSuperuser } from "@/lib/superuser";

export default async function OnboardingPage() {
  if (await getIsSuperuser()) {
    redirect("/admin");
  }

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
