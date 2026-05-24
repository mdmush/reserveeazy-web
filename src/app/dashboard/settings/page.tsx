import { getUserMembership } from "@/lib/business";
import { SettingsForm } from "@/components/dashboard/settings-form";

export default async function SettingsPage() {
  const membership = await getUserMembership();
  if (!membership) return null;

  return <SettingsForm business={membership.businesses} />;
}
