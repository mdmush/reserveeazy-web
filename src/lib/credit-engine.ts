import type { PackageInstance } from "@/types/database";

/**
 * Pure TS mirror of the SQL engine's ordering/cost/window math, used for UI
 * previews ("this booking will use Aeroyoga 8 — 1 credit") and unit tests.
 * The SECURITY DEFINER RPCs remain the source of truth; if these disagree,
 * the SQL wins and this file has a bug.
 */

export type FundableInstance = PackageInstance & { balance: number };

/** Cost rule: locked packages pay 1 credit/class; flexible pay the class type's cost. */
export function classCreditCost(
  scope: "locked" | "flexible",
  classTypeCreditCost: number
): number {
  return scope === "locked" ? 1 : classTypeCreditCost;
}

/**
 * Instances able to fund a booking for the given class type, in deduction
 * order: locked-first, then soonest expiry, then oldest purchase (spec §6.4).
 */
export function orderEligibleInstances<T extends FundableInstance>(
  instances: T[],
  classTypeId: string,
  classTypeCreditCost: number,
  now: Date = new Date()
): T[] {
  return instances
    .filter((instance) => {
      const scopeCovers =
        instance.scope === "flexible" || instance.class_type_id === classTypeId;
      const notExpired =
        !instance.expires_at || new Date(instance.expires_at) > now;
      const cost = classCreditCost(instance.scope, classTypeCreditCost);
      return scopeCovers && notExpired && instance.balance >= cost;
    })
    .sort((a, b) => {
      if ((a.scope === "locked") !== (b.scope === "locked")) {
        return a.scope === "locked" ? -1 : 1;
      }
      const aExp = a.expires_at ? new Date(a.expires_at).getTime() : Infinity;
      const bExp = b.expires_at ? new Date(b.expires_at).getTime() : Infinity;
      if (aExp !== bExp) return aExp - bExp;
      return (
        new Date(a.purchased_at).getTime() - new Date(b.purchased_at).getTime()
      );
    });
}

/** Outcome of cancelling now: at/after the cutoff boundary counts as early. */
export function cancellationOutcome(
  now: Date,
  startAt: Date,
  cutoffHours: number
): "refund" | "forfeit" {
  return startAt.getTime() - now.getTime() >= cutoffHours * 3600_000
    ? "refund"
    : "forfeit";
}

/**
 * Claim-window end for a waitlist offer: the configured window, shrunk so it
 * never crosses the cancellation cutoff (spec §6.7). Returns null when no
 * usable window remains.
 */
export function offerWindowEnd(
  now: Date,
  startAt: Date,
  claimMinutes: number,
  cutoffHours: number
): Date | null {
  const windowEnd = Math.min(
    now.getTime() + claimMinutes * 60_000,
    startAt.getTime() - cutoffHours * 3600_000
  );
  return windowEnd > now.getTime() ? new Date(windowEnd) : null;
}
