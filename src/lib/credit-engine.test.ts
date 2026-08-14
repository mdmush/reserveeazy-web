import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classCreditCost,
  orderEligibleInstances,
  cancellationOutcome,
  offerWindowEnd,
  type FundableInstance,
} from "./credit-engine.ts";

const NOW = new Date("2026-08-14T10:00:00Z");
const BALLET = "ballet-type-id";
const AERO = "aero-type-id";

function instance(overrides: Partial<FundableInstance>): FundableInstance {
  return {
    id: "i",
    business_id: "b",
    package_id: "p",
    client_id: "c",
    scope: "flexible",
    class_type_id: null,
    credit_count: 30,
    validity_days: 365,
    expiry_trigger: "first_attendance",
    purchased_at: "2026-08-01T00:00:00Z",
    activated_at: null,
    expires_at: null,
    created_by: null,
    balance: 30,
    ...overrides,
  };
}

test("cost rule: locked pays 1, flexible pays the class type's cost", () => {
  assert.equal(classCreditCost("locked", 12), 1);
  assert.equal(classCreditCost("flexible", 12), 12);
});

test("deduction order: locked-first, then soonest expiry, then oldest purchase", () => {
  const flexible = instance({ id: "flex", balance: 30 });
  const lockedLater = instance({
    id: "locked-later",
    scope: "locked",
    class_type_id: BALLET,
    balance: 4,
    expires_at: "2026-12-01T00:00:00Z",
  });
  const lockedSooner = instance({
    id: "locked-sooner",
    scope: "locked",
    class_type_id: BALLET,
    balance: 4,
    expires_at: "2026-09-01T00:00:00Z",
  });
  const ordered = orderEligibleInstances(
    [flexible, lockedLater, lockedSooner],
    BALLET,
    12,
    NOW
  );
  assert.deepEqual(
    ordered.map((i) => i.id),
    ["locked-sooner", "locked-later", "flex"]
  );
});

test("eligibility: wrong class type, expiry, and insufficient balance filter out", () => {
  const wrongType = instance({
    id: "wrong",
    scope: "locked",
    class_type_id: AERO,
    balance: 4,
  });
  const expired = instance({
    id: "expired",
    expires_at: "2026-08-01T00:00:00Z",
  });
  const broke = instance({ id: "broke", balance: 5 });
  const good = instance({ id: "good", balance: 12 });
  const ordered = orderEligibleInstances(
    [wrongType, expired, broke, good],
    BALLET,
    12,
    NOW
  );
  assert.deepEqual(
    ordered.map((i) => i.id),
    ["good"]
  );
});

test("unactivated (null expiry) instances sort after expiring ones", () => {
  const unactivated = instance({
    id: "unactivated",
    scope: "locked",
    class_type_id: BALLET,
    balance: 4,
    expires_at: null,
  });
  const activated = instance({
    id: "activated",
    scope: "locked",
    class_type_id: BALLET,
    balance: 4,
    expires_at: "2026-10-01T00:00:00Z",
  });
  const ordered = orderEligibleInstances(
    [unactivated, activated],
    BALLET,
    12,
    NOW
  );
  assert.deepEqual(
    ordered.map((i) => i.id),
    ["activated", "unactivated"]
  );
});

test("cancellation boundary: exactly 24h before start still refunds", () => {
  const start = new Date("2026-08-15T10:00:00Z");
  assert.equal(cancellationOutcome(NOW, start, 24), "refund");
  assert.equal(
    cancellationOutcome(new Date("2026-08-14T10:00:01Z"), start, 24),
    "forfeit"
  );
});

test("offer window: full window when class is far out", () => {
  const start = new Date("2026-08-16T10:00:00Z");
  const end = offerWindowEnd(NOW, start, 120, 24);
  assert.equal(end?.toISOString(), "2026-08-14T12:00:00.000Z");
});

test("offer window shrinks to the cancellation cutoff", () => {
  const start = new Date("2026-08-15T11:00:00Z"); // cutoff at 11:00 today
  const end = offerWindowEnd(NOW, start, 120, 24);
  assert.equal(end?.toISOString(), "2026-08-14T11:00:00.000Z");
});

test("offer window is null once inside the cutoff", () => {
  const start = new Date("2026-08-14T20:00:00Z");
  assert.equal(offerWindowEnd(NOW, start, 120, 24), null);
});
