#!/usr/bin/env node
/**
 * Credit-engine integration tests, run against the live DB using the UAT
 * studios (run `npm run seed:uat` first). Service role does setup/inspection;
 * all engine calls go through the RPCs as the studio owner — exactly like the
 * app. Asserts the spec's resolved rules: locked-first deduction, cost
 * snapshots, refund-to-source, anti-parking activation, capacity → waitlist →
 * offer windows, gapless receipts, overlap rejections.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

let failures = 0;
function check(condition, label, extra = "") {
  if (condition) {
    console.log(`PASS: ${label}`);
  } else {
    console.error(`FAIL: ${label}${extra ? ` — ${extra}` : ""}`);
    failures++;
  }
}

function loadEnv() {
  const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  const env = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [key, ...rest] = trimmed.split("=");
    env[key] = rest.join("=");
  }
  return env;
}

async function main() {
  const env = loadEnv();
  const admin = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  const owner = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  );

  console.log("CUSP credit-engine test\n");

  // ---- context: seeded studio B (credits mode) --------------------------
  const { data: biz } = await admin
    .from("businesses")
    .select("id")
    .eq("slug", "studio-b-uat")
    .single();
  if (!biz) {
    console.error("FAIL: studio-b-uat not found — run `npm run seed:uat` first");
    process.exit(1);
  }
  const bizId = biz.id;
  const { data: classTypes } = await admin
    .from("class_types")
    .select("id, name, credit_cost, default_capacity")
    .eq("business_id", bizId);
  const aero = classTypes.find((ct) => ct.name === "Aeroyoga");
  const ballet = classTypes.find((ct) => ct.name === "Ballet Beginner");
  const { data: teacher } = await admin
    .from("business_members")
    .select("id")
    .eq("business_id", bizId)
    .eq("role", "owner")
    .single();
  const { data: client1 } = await admin
    .from("clients")
    .select("id")
    .eq("business_id", bizId)
    .eq("email", "member@cusp-uat.test")
    .single();

  // ---- reset engine state for repeatability (FK-safe order) -------------
  const resetTables = [
    "waiver_acceptances",
    "waiver_versions",
    "commission_events",
    "payment_dues",
    "grace_passes",
    "credit_transactions",
    "bookings",
    "payments",
    "package_instances",
    "packages",
    "receipt_counters",
    "commission_rates",
  ];
  // dependents from prior runs (FK to bookings already cleared above)
  await admin
    .from("clients")
    .delete()
    .eq("business_id", bizId)
    .eq("email", "dependent@cusp-uat.test");
  for (const table of resetTables) {
    const { error } = await admin.from(table).delete().eq("business_id", bizId);
    if (error) throw new Error(`reset ${table}: ${error.message}`);
  }
  {
    const { error } = await admin
      .from("class_sessions")
      .delete()
      .eq("business_id", bizId)
      .eq("room", "engine-test");
    if (error) throw new Error(`reset class_sessions: ${error.message}`);
  }

  // second client + second teacher for overlap/waitlist scenarios
  const { data: client2 } = await admin
    .from("clients")
    .upsert(
      {
        business_id: bizId,
        full_name: "Engine Test Member 2",
        email: "member2@cusp-uat.test",
      },
      { onConflict: undefined, ignoreDuplicates: false }
    )
    .select("id")
    .single()
    .then(async (r) => {
      if (r.data) return r;
      const existing = await admin
        .from("clients")
        .select("id")
        .eq("business_id", bizId)
        .eq("email", "member2@cusp-uat.test")
        .single();
      return existing;
    });
  let { data: teacher2 } = await admin
    .from("business_members")
    .select("id")
    .eq("business_id", bizId)
    .eq("display_name", "Second Teacher")
    .limit(1)
    .maybeSingle();
  if (!teacher2) {
    const { data: created, error: t2Error } = await admin
      .from("business_members")
      .insert({
        business_id: bizId,
        display_name: "Second Teacher",
        role: "staff",
        is_bookable: true,
      })
      .select("id")
      .single();
    if (t2Error) throw new Error(`teacher2 setup: ${t2Error.message}`);
    teacher2 = created;
  }

  // dedicated sessions
  const hours = (h) => new Date(Date.now() + h * 3600_000).toISOString();
  const mkSession = async (classTypeId, teacherId, startH, durH, capacity) => {
    const { data, error } = await admin
      .from("class_sessions")
      .insert({
        business_id: bizId,
        class_type_id: classTypeId,
        teacher_id: teacherId,
        start_at: hours(startH),
        end_at: hours(startH + durH),
        capacity,
        room: "engine-test",
      })
      .select("id")
      .single();
    if (error) throw new Error(`session setup: ${error.message}`);
    return data.id;
  };
  const aeroSoon = await mkSession(aero.id, teacher.id, 2, 1, 8); // <24h → late-cancel target
  const aeroLater = await mkSession(aero.id, teacher.id, 30, 1, 8);
  const balletLater = await mkSession(ballet.id, teacher.id, 33, 1, 12);
  const tinyClass = await mkSession(ballet.id, teacher2.id, 40, 1, 1); // capacity 1
  const overlapClass = await mkSession(ballet.id, teacher2.id, 30, 1, 12); // same time as aeroLater

  // ---- member auth users (portal) ---------------------------------------
  // Simulates completed join flows: client1 belongs to member1, client2 to
  // member2. Service-role links stand in for join_studio (tested separately).
  const memberEmails = ["portal-m1@cusp-uat.test", "portal-m2@cusp-uat.test"];
  const { data: allUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const u of allUsers.users.filter((u) => memberEmails.includes(u.email))) {
    await admin.auth.admin.deleteUser(u.id);
  }
  const memberIds = [];
  for (const memberEmail of memberEmails) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email: memberEmail,
      password: "cusp-uat-password-1",
      email_confirm: true,
    });
    if (error) throw new Error(`member user: ${error.message}`);
    memberIds.push(created.user.id);
  }
  await admin.from("clients").update({ user_id: memberIds[0] }).eq("id", client1.id);
  await admin.from("clients").update({ user_id: memberIds[1] }).eq("id", client2.id);
  const member1 = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  );
  await member1.auth.signInWithPassword({
    email: memberEmails[0],
    password: "cusp-uat-password-1",
  });

  // ---- sign in as owner B ----------------------------------------------
  const { error: signInError } = await owner.auth.signInWithPassword({
    email: "owner-b@cusp-uat.test",
    password: "cusp-uat-password-1",
  });
  if (signInError) throw new Error(`owner sign-in: ${signInError.message}`);

  // ---- packages + receipts ---------------------------------------------
  const { data: pkgRows, error: pkgError } = await admin
    .from("packages")
    .insert([
      {
        business_id: bizId,
        name: "Aeroyoga 8",
        scope: "locked",
        class_type_id: aero.id,
        credit_count: 8,
        validity_days: 60,
        price_cents: 32000,
      },
      {
        business_id: bizId,
        name: "Credit 30",
        scope: "flexible",
        credit_count: 30,
        validity_days: 365,
        price_cents: 30000,
      },
    ])
    .select("id, name");
  if (pkgError) throw new Error(pkgError.message);
  const lockedPkg = pkgRows.find((p) => p.name === "Aeroyoga 8");
  const flexPkg = pkgRows.find((p) => p.name === "Credit 30");

  const sell = async (packageId) => {
    const { data, error } = await owner.rpc("assign_package", {
      p_client_id: client1.id,
      p_package_id: packageId,
      p_amount_cents: 30000,
      p_method: "cash",
    });
    if (error) throw new Error(`assign_package: ${error.message}`);
    return data;
  };
  const sale1 = await sell(lockedPkg.id);
  const sale2 = await sell(flexPkg.id);
  check(
    sale1.receipt_number === "R-000001" && sale2.receipt_number === "R-000002",
    "receipt numbers are gapless and sequential",
    `${sale1.receipt_number}, ${sale2.receipt_number}`
  );
  const lockedInstance = sale1.package_instance_id;
  const flexInstance = sale2.package_instance_id;

  // ---- booking: locked-first + cost snapshots ---------------------------
  const { data: bookAero, error: bookAeroErr } = await owner.rpc("book_class", {
    p_class_session_id: aeroLater,
    p_client_id: client1.id,
  });
  check(
    !bookAeroErr &&
      bookAero.package_instance_id === lockedInstance &&
      bookAero.credit_cost === 1,
    "aeroyoga booking pays 1 credit from the LOCKED package first",
    bookAeroErr?.message ?? JSON.stringify(bookAero)
  );

  const { data: bookBallet, error: bookBalletErr } = await owner.rpc(
    "book_class",
    { p_class_session_id: balletLater, p_client_id: client1.id }
  );
  check(
    !bookBalletErr &&
      bookBallet.package_instance_id === flexInstance &&
      bookBallet.credit_cost === ballet.credit_cost,
    `ballet booking pays ${ballet.credit_cost} credits from the FLEXIBLE tier`,
    bookBalletErr?.message ?? JSON.stringify(bookBallet)
  );

  const balances = async () => {
    const { data } = await admin
      .from("package_instance_balances")
      .select("package_instance_id, balance")
      .eq("business_id", bizId);
    return Object.fromEntries(data.map((b) => [b.package_instance_id, b.balance]));
  };
  let bal = await balances();
  check(
    bal[lockedInstance] === 7 && bal[flexInstance] === 30 - ballet.credit_cost,
    "balances derived from ledger are correct after bookings"
  );

  // ---- duplicate + overlap rejections -----------------------------------
  const { error: dupErr } = await owner.rpc("book_class", {
    p_class_session_id: aeroLater,
    p_client_id: client1.id,
  });
  check(!!dupErr, "duplicate booking on the same session is rejected");

  const { error: overlapErr } = await owner.rpc("book_class", {
    p_class_session_id: overlapClass,
    p_client_id: client1.id,
  });
  check(
    overlapErr?.message?.includes("already has a booking"),
    "member time-overlap is rejected",
    overlapErr?.message
  );

  // ---- early cancel refunds to source -----------------------------------
  const { data: cancelBallet, error: cancelBalletErr } = await owner.rpc(
    "cancel_booking",
    { p_booking_id: bookBallet.booking_id }
  );
  bal = await balances();
  check(
    !cancelBalletErr &&
      cancelBallet.outcome === "refunded" &&
      bal[flexInstance] === 30,
    "early cancellation refunds to the source (flexible) package"
  );

  // ---- late cancel: forfeit + anti-parking activation -------------------
  const { data: bookSoon, error: bookSoonErr } = await owner.rpc("book_class", {
    p_class_session_id: aeroSoon,
    p_client_id: client1.id,
  });
  if (bookSoonErr) throw new Error(bookSoonErr.message);
  const { data: cancelSoon } = await owner.rpc("cancel_booking", {
    p_booking_id: bookSoon.booking_id,
  });
  bal = await balances();
  const { data: lockedRow } = await admin
    .from("package_instances")
    .select("activated_at, expires_at")
    .eq("id", lockedInstance)
    .single();
  check(
    cancelSoon.outcome === "forfeited" && bal[lockedInstance] === 6,
    "late cancellation forfeits the credit"
  );
  check(
    lockedRow.activated_at !== null && lockedRow.expires_at !== null,
    "anti-parking: late cancel of unactivated package starts its validity clock"
  );
  check(
    !!cancelSoon.activated_expiry,
    "cancel_booking reports the activation for the wa.me template"
  );

  // ---- force refund (policy override) restores and is ledgered ----------
  const { data: bookSoon2 } = await owner.rpc("book_class", {
    p_class_session_id: aeroSoon,
    p_client_id: client1.id,
  });
  const { data: forceCancel } = await owner.rpc("cancel_booking", {
    p_booking_id: bookSoon2.booking_id,
    p_force_refund: true,
  });
  bal = await balances();
  check(
    forceCancel.outcome === "refunded" && bal[lockedInstance] === 6,
    "force-refund override restores the credit despite the cutoff"
  );

  // ---- insufficient credits ---------------------------------------------
  const { error: brokeErr } = await owner.rpc("book_class", {
    p_class_session_id: balletLater,
    p_client_id: client2.id,
  });
  check(
    brokeErr?.message?.includes("No eligible package"),
    "booking without an eligible package is rejected",
    brokeErr?.message
  );

  // ---- capacity → waitlist → offer window --------------------------------
  const { data: seatTaken, error: seatErr } = await owner.rpc("book_class", {
    p_class_session_id: tinyClass,
    p_client_id: client1.id,
  });
  if (seatErr) throw new Error(seatErr.message);
  const { data: waitlisted, error: waitErr } = await owner.rpc("book_class", {
    p_class_session_id: tinyClass,
    p_client_id: client2.id,
  });
  check(
    !waitErr &&
      waitlisted.status === "waitlisted" &&
      waitlisted.waitlist_position === 1,
    "capacity-full booking joins the waitlist without deduction",
    waitErr?.message
  );

  const { data: freeSeat } = await owner.rpc("cancel_booking", {
    p_booking_id: seatTaken.booking_id,
  });
  check(
    freeSeat.offer?.booking_id === waitlisted.booking_id &&
      new Date(freeSeat.offer.offer_expires_at) > new Date(),
    "freed seat is OFFERED to the waitlist head with a claim window (never auto-booked)"
  );
  const windowMinutes =
    (new Date(freeSeat.offer.offer_expires_at) - Date.now()) / 60000;
  check(
    windowMinutes > 100 && windowMinutes <= 125,
    "claim window is ~120 minutes (session far enough out)",
    `${Math.round(windowMinutes)}m`
  );
  const { data: offeredRow } = await admin
    .from("bookings")
    .select("status, paid_by_package_instance_id")
    .eq("id", waitlisted.booking_id)
    .single();
  check(
    offeredRow.status === "offered" &&
      offeredRow.paid_by_package_instance_id === null,
    "offered booking still holds no deduction (deduct at claim)"
  );

  // ---- attendance + commission (M4) --------------------------------------
  // Rates: teacher default RM5/head, aeroyoga-specific RM7/head.
  await admin.from("commission_rates").delete().eq("business_id", bizId);
  const { error: rateErr } = await owner.from("commission_rates").insert([
    {
      business_id: bizId,
      teacher_id: teacher.id,
      class_type_id: null,
      rate_per_head_cents: 500,
    },
    {
      business_id: bizId,
      teacher_id: teacher.id,
      class_type_id: aero.id,
      rate_per_head_cents: 700,
    },
  ]);
  check(!rateErr, "admin can set commission rates", rateErr?.message);

  // A session starting in 5 minutes: bookable AND markable.
  const aeroNow = await mkSession(aero.id, teacher.id, 5 / 60, 1, 8);
  const { data: bookNow, error: bookNowErr } = await owner.rpc("book_class", {
    p_class_session_id: aeroNow,
    p_client_id: client1.id,
  });
  if (bookNowErr) throw new Error(bookNowErr.message);

  const { data: farBooking } = await admin
    .from("bookings")
    .select("id")
    .eq("class_session_id", aeroLater)
    .eq("client_id", client1.id)
    .eq("status", "booked")
    .single();
  const { error: tooEarlyErr } = await owner.rpc("mark_attendance", {
    p_booking_id: farBooking.id,
    p_present: true,
  });
  check(
    tooEarlyErr?.message?.includes("Too early"),
    "attendance cannot be pre-marked long before the session"
  );

  const { data: attended, error: attendErr } = await owner.rpc(
    "mark_attendance",
    { p_booking_id: bookNow.booking_id, p_present: true }
  );
  check(
    !attendErr && attended.status === "attended" && attended.commission_cents === 700,
    "attendance uses the class-type-specific rate over the teacher default",
    attendErr?.message ?? JSON.stringify(attended)
  );

  // Rate snapshot proof: change the rate, the recorded event must not move.
  await owner
    .from("commission_rates")
    .update({ rate_per_head_cents: 999 })
    .eq("business_id", bizId)
    .eq("class_type_id", aero.id);
  const { data: eventRows } = await admin
    .from("commission_events")
    .select("rate_snapshot_cents")
    .eq("booking_id", bookNow.booking_id);
  check(
    eventRows.length === 1 && eventRows[0].rate_snapshot_cents === 700,
    "commission events snapshot the rate at attendance time"
  );

  // Activation on first attendance: client2's fresh flexible package.
  const { data: c2Pkg } = await owner.rpc("assign_package", {
    p_client_id: client2.id,
    p_package_id: flexPkg.id,
    p_amount_cents: 30000,
    p_method: "cash",
  });
  const { data: bookC2 } = await owner.rpc("book_class", {
    p_class_session_id: aeroNow,
    p_client_id: client2.id,
  });
  const { data: attendC2 } = await owner.rpc("mark_attendance", {
    p_booking_id: bookC2.booking_id,
    p_present: true,
  });
  const { data: c2Instance } = await admin
    .from("package_instances")
    .select("activated_at, expires_at")
    .eq("id", c2Pkg.package_instance_id)
    .single();
  check(
    !!attendC2.activated_expiry &&
      c2Instance.activated_at !== null &&
      c2Instance.expires_at !== null,
    "first attendance activates the package and sets its expiry"
  );

  // Revert: status restored, compensating negative commission row.
  const { data: reverted, error: revertErr } = await owner.rpc(
    "revert_attendance",
    { p_booking_id: bookNow.booking_id, p_reason: "marked by mistake" }
  );
  const { data: netRows } = await admin
    .from("commission_events")
    .select("rate_snapshot_cents")
    .eq("booking_id", bookNow.booking_id);
  const net = netRows.reduce((sum, r) => sum + r.rate_snapshot_cents, 0);
  check(
    !revertErr && reverted.status === "booked" && netRows.length === 2 && net === 0,
    "revert_attendance restores the booking and nets commission to zero via a compensating row",
    revertErr?.message
  );

  // ---- mode B: attendance creates a payment due --------------------------
  await admin
    .from("businesses")
    .update({ pricing_mode: "pay_per_class" })
    .eq("id", bizId);
  const { data: attendB } = await owner.rpc("mark_attendance", {
    p_booking_id: bookNow.booking_id,
    p_present: true,
  });
  const { data: due } = await admin
    .from("payment_dues")
    .select("id, amount_cents, status")
    .eq("booking_id", bookNow.booking_id)
    .single();
  check(
    attendB?.status === "attended" &&
      due?.status === "due" &&
      due?.amount_cents === 4500,
    "pay-per-class attendance creates a due at the class drop-in price"
  );
  const { data: settled, error: settleErr } = await owner.rpc(
    "record_due_payment",
    { p_payment_due_id: due.id, p_method: "duitnow_qr" }
  );
  check(
    !settleErr && settled.receipt_number?.startsWith("R-0000"),
    "settling a due issues the next numbered receipt",
    settleErr?.message ?? settled?.receipt_number
  );
  await admin
    .from("businesses")
    .update({ pricing_mode: "credits" })
    .eq("id", bizId);

  // ---- grace passes (M5) --------------------------------------------------
  const { error: noReasonErr } = await owner.rpc("grant_grace_pass", {
    p_client_id: client1.id,
    p_reason: "  ",
  });
  check(!!noReasonErr, "pass grant without a reason is rejected");

  // bookSoon was late-cancelled earlier — a valid missed-class source.
  const { data: passId, error: grantErr } = await owner.rpc("grant_grace_pass", {
    p_client_id: client1.id,
    p_reason: "Medical certificate provided",
    p_source_booking_id: bookSoon.booking_id,
  });
  check(!!passId && !grantErr, "pass granted with reason + missed-class source", grantErr?.message);

  const { error: dupPassErr } = await owner.rpc("grant_grace_pass", {
    p_client_id: client1.id,
    p_reason: "again",
    p_source_booking_id: bookSoon.booking_id,
  });
  check(!!dupPassErr, "second pass for the same missed class is rejected");

  // Redeeming into the SAME class type (aeroyoga) must fail...
  const aeroPassTarget = await mkSession(aero.id, teacher2.id, 50, 1, 8);
  const { error: sameTypeErr } = await owner.rpc("book_class", {
    p_class_session_id: aeroPassTarget,
    p_client_id: client1.id,
    p_grace_pass_id: passId,
  });
  check(
    sameTypeErr?.message?.includes("different class type"),
    "pass cannot be redeemed for the same class type as the missed class"
  );

  // ...but a ballet class works, consumes no credits, and redeems the pass.
  const balBefore = await balances();
  const balletPassTarget = await mkSession(ballet.id, teacher2.id, 52, 1, 8);
  const { data: passBooking, error: passBookErr } = await owner.rpc("book_class", {
    p_class_session_id: balletPassTarget,
    p_client_id: client1.id,
    p_grace_pass_id: passId,
  });
  const balAfter = await balances();
  const { data: passRow } = await admin
    .from("grace_passes")
    .select("status, redeemed_booking_id")
    .eq("id", passId)
    .single();
  check(
    !passBookErr &&
      passBooking.status === "pass_makeup" &&
      passRow.status === "redeemed" &&
      JSON.stringify(balBefore) === JSON.stringify(balAfter),
    "pass books a different class type without touching credit balances",
    passBookErr?.message
  );

  // Early cancel of a pass booking returns the pass.
  const { data: passCancel } = await owner.rpc("cancel_booking", {
    p_booking_id: passBooking.booking_id,
  });
  const { data: passRow2 } = await admin
    .from("grace_passes")
    .select("status")
    .eq("id", passId)
    .single();
  check(
    passCancel.outcome === "refunded" && passRow2.status === "available",
    "early cancel of a pass booking makes the pass available again"
  );

  // ---- family: no cross-member credit usage (§6.4.1) ---------------------
  const { data: dependent } = await admin
    .from("clients")
    .insert({
      business_id: bizId,
      full_name: "Dependent Child",
      email: "dependent@cusp-uat.test",
      guardian_client_id: client1.id,
    })
    .select("id")
    .single();
  const depSession = await mkSession(ballet.id, teacher2.id, 60, 1, 8);
  const { error: depFundErr } = await owner.rpc("book_class", {
    p_class_session_id: depSession,
    p_client_id: dependent.id,
  });
  check(
    depFundErr?.message?.includes("No eligible package"),
    "guardian's credits can NEVER fund a dependent's class",
    depFundErr?.message
  );

  // ---- waivers: gate off → published → accepted → republished -------------
  const { data: w1 } = await admin
    .from("waiver_versions")
    .insert({
      business_id: bizId,
      version: 1,
      title: "Liability waiver",
      body: "I accept the risks of aerial classes.",
    })
    .select("id")
    .single();
  const { data: draftOk, error: draftErr } = await owner.rpc("book_class", {
    p_class_session_id: aeroPassTarget,
    p_client_id: client2.id,
  });
  check(
    !draftErr && draftOk?.booking_id,
    "a DRAFT waiver does not gate bookings",
    draftErr?.message
  );
  await owner.rpc("cancel_booking", { p_booking_id: draftOk.booking_id });

  await admin
    .from("waiver_versions")
    .update({ published_at: new Date().toISOString() })
    .eq("id", w1.id);
  const { error: gatedErr } = await owner.rpc("book_class", {
    p_class_session_id: aeroPassTarget,
    p_client_id: client2.id,
  });
  check(
    gatedErr?.message?.includes("waiver"),
    "publishing the waiver blocks bookings for members who have not accepted",
    gatedErr?.message
  );

  const { error: acceptErr } = await owner.rpc("record_waiver_acceptance", {
    p_client_id: client2.id,
    p_signature_name: "Engine Test Member 2",
  });
  const { data: postAccept, error: postAcceptErr } = await owner.rpc(
    "book_class",
    { p_class_session_id: aeroPassTarget, p_client_id: client2.id }
  );
  check(
    !acceptErr && !postAcceptErr && postAccept?.booking_id,
    "recording acceptance unblocks booking",
    acceptErr?.message ?? postAcceptErr?.message
  );
  // Return the credits so later waitlist scenarios have headroom.
  await owner.rpc("cancel_booking", { p_booking_id: postAccept.booking_id });

  await admin.from("waiver_versions").insert({
    business_id: bizId,
    version: 2,
    title: "Liability waiver v2",
    body: "Updated terms.",
    published_at: new Date().toISOString(),
  });
  const freshSession = await mkSession(ballet.id, teacher2.id, 64, 1, 8);
  const { error: v2Err } = await owner.rpc("book_class", {
    p_class_session_id: freshSession,
    p_client_id: client2.id,
  });
  check(
    v2Err?.message?.includes("waiver"),
    "publishing waiver v2 forces re-acceptance"
  );

  // dependent acceptance requires the guardian
  const { error: depSelfErr } = await owner.rpc("record_waiver_acceptance", {
    p_client_id: dependent.id,
    p_signature_name: "Dependent Child",
  });
  check(
    depSelfErr?.message?.includes("guardian"),
    "a dependent cannot self-accept — the guardian must sign"
  );
  const { error: depGuardianErr } = await owner.rpc("record_waiver_acceptance", {
    p_client_id: dependent.id,
    p_signature_name: "Member of UAT Studio B (guardian)",
    p_accepted_by_client_id: client1.id,
  });
  check(
    !depGuardianErr,
    "the linked guardian can accept for the dependent",
    depGuardianErr?.message
  );

  // ---- waitlist claim / release / expiry ---------------------------------
  // client2 holds the offer on tinyClass from the earlier scenario.
  const { data: claimed, error: claimErr } = await owner.rpc(
    "claim_waitlist_offer",
    { p_booking_id: waitlisted.booking_id }
  );
  check(
    !claimErr &&
      claimed.status === "booked" &&
      claimed.credit_cost === ballet.credit_cost,
    "claiming an offer funds the booking at claim time",
    claimErr?.message
  );

  // Fill the class again: client1 rebooks (their earlier booking was
  // cancelled), landing on the waitlist. v2 acceptance needed first.
  await owner.rpc("record_waiver_acceptance", {
    p_client_id: client1.id,
    p_signature_name: "Member of UAT Studio B",
  });
  const { data: rewait } = await owner.rpc("book_class", {
    p_class_session_id: tinyClass,
    p_client_id: client1.id,
  });
  check(
    rewait?.status === "waitlisted",
    "a cancelled member can rejoin the same session's waitlist"
  );

  // Free the seat → client1 gets the offer; then release it.
  await owner.rpc("cancel_booking", { p_booking_id: waitlisted.booking_id });
  const { data: offeredNow } = await admin
    .from("bookings")
    .select("status")
    .eq("id", rewait.booking_id)
    .single();
  check(offeredNow.status === "offered", "freed seat auto-offers to the next in line");

  const { data: released, error: releaseErr } = await owner.rpc(
    "release_waitlist_offer",
    { p_booking_id: rewait.booking_id }
  );
  const { data: afterRelease } = await admin
    .from("bookings")
    .select("status, offer_expires_at")
    .eq("id", rewait.booking_id)
    .single();
  check(
    !releaseErr && afterRelease.status === "waitlisted" && !afterRelease.offer_expires_at,
    "releasing an offer returns the member to the waitlist",
    releaseErr?.message
  );

  // Manual re-offer, then simulate expiry → claim must fail.
  const { data: reoffered, error: reofferErr } = await owner.rpc(
    "offer_waitlist_spot",
    { p_booking_id: rewait.booking_id }
  );
  check(
    !reofferErr && !!reoffered.offer_expires_at,
    "admin can manually offer a free seat",
    reofferErr?.message
  );
  await admin
    .from("bookings")
    .update({ offer_expires_at: new Date(Date.now() - 60_000).toISOString() })
    .eq("id", rewait.booking_id);
  const { error: expiredErr } = await owner.rpc("claim_waitlist_offer", {
    p_booking_id: rewait.booking_id,
  });
  check(
    expiredErr?.message?.includes("expired"),
    "an expired claim window cannot be claimed"
  );

  // ---- member portal: self-service through the same engine ----------------
  // client1 (member1) accepted waiver v2 above; book with own credits.
  const memberSession = await mkSession(ballet.id, teacher.id, 70, 1, 8);
  const { data: memberBook, error: memberBookErr } = await member1.rpc(
    "book_class",
    { p_class_session_id: memberSession, p_client_id: client1.id }
  );
  check(
    !memberBookErr && memberBook.status === "booked" && memberBook.credit_cost === ballet.credit_cost,
    "member books their own class with their own credits",
    memberBookErr?.message
  );

  const { error: strangerErr } = await member1.rpc("book_class", {
    p_class_session_id: memberSession,
    p_client_id: client2.id,
  });
  check(
    strangerErr?.message?.includes("Not allowed"),
    "member cannot book for another member"
  );

  const { error: memberForceErr } = await member1.rpc("cancel_booking", {
    p_booking_id: memberBook.booking_id,
    p_force_refund: true,
  });
  check(
    memberForceErr?.message?.includes("Admin access required"),
    "member cannot use the force-refund override"
  );
  const { data: memberCancel } = await member1.rpc("cancel_booking", {
    p_booking_id: memberBook.booking_id,
  });
  check(
    memberCancel?.outcome === "refunded",
    "member early-cancels their own booking with refund-to-source"
  );

  // Guardian: member1's client is the dependent's guardian.
  const { error: depWaiverErr } = await member1.rpc("record_waiver_acceptance", {
    p_client_id: dependent.id,
    p_signature_name: "Guardian via portal",
    p_accepted_by_client_id: client1.id,
  });
  check(
    !depWaiverErr || depWaiverErr.message.includes("already accepted"),
    "guardian signs the waiver for their dependent from the portal",
    depWaiverErr?.message
  );

  // Member claims their own waitlist offer.
  await owner.rpc("record_waiver_acceptance", {
    p_client_id: client2.id,
    p_signature_name: "Engine Test Member 2 (v2)",
  });
  const claimSession = await mkSession(ballet.id, teacher2.id, 72, 1, 1);
  const { data: seatB, error: seatBErr } = await owner.rpc("book_class", {
    p_class_session_id: claimSession,
    p_client_id: client2.id,
  });
  if (seatBErr) throw new Error(`claim setup: ${seatBErr.message}`);
  const { data: memberWait } = await member1.rpc("book_class", {
    p_class_session_id: claimSession,
    p_client_id: client1.id,
  });
  check(
    memberWait?.status === "waitlisted",
    "member joins a full class's waitlist themselves"
  );
  await owner.rpc("cancel_booking", { p_booking_id: seatB.booking_id });
  const { data: memberClaim, error: memberClaimErr } = await member1.rpc(
    "claim_waitlist_offer",
    { p_booking_id: memberWait.booking_id }
  );
  check(
    !memberClaimErr && memberClaim.status === "booked",
    "member claims their own offered spot",
    memberClaimErr?.message
  );

  // Mode B: booking carries null funding; attendance creates the due.
  await admin.from("businesses").update({ pricing_mode: "pay_per_class" }).eq("id", bizId);
  const modeBSession = await mkSession(aero.id, teacher2.id, 5 / 60, 1, 8);
  const { data: modeBBook, error: modeBErr } = await member1.rpc("book_class", {
    p_class_session_id: modeBSession,
    p_client_id: client1.id,
  });
  check(
    !modeBErr && modeBBook.status === "booked" && modeBBook.credit_cost === null,
    "pay-per-class booking succeeds without credit packages (mode-B fix)",
    modeBErr?.message
  );
  const { data: modeBAttend } = await owner.rpc("mark_attendance", {
    p_booking_id: modeBBook.booking_id,
    p_present: true,
  });
  const { data: modeBDue } = await admin
    .from("payment_dues")
    .select("status, amount_cents")
    .eq("booking_id", modeBBook.booking_id)
    .single();
  check(
    modeBAttend?.status === "attended" && modeBDue?.status === "due",
    "mode-B attendance on a member booking creates the payment due"
  );
  await admin.from("businesses").update({ pricing_mode: "credits" }).eq("id", bizId);

  // Admin-only RPCs stay sealed to members.
  const { error: mAssignErr } = await member1.rpc("assign_package", {
    p_client_id: client1.id,
    p_package_id: flexPkg.id,
    p_amount_cents: 100,
    p_method: "cash",
  });
  const { error: mAdjustErr } = await member1.rpc("adjust_credits", {
    p_package_instance_id: flexInstance,
    p_amount: 99,
    p_reason: "nope",
  });
  const { error: mAttendErr } = await member1.rpc("mark_attendance", {
    p_booking_id: memberClaim.booking_id,
    p_present: true,
  });
  check(
    !!mAssignErr && !!mAdjustErr && !!mAttendErr,
    "members cannot assign packages, adjust credits, or mark attendance"
  );
  await member1.auth.signOut();

  // ---- cross-tenant admin rejection --------------------------------------
  await owner.auth.signOut();
  await owner.auth.signInWithPassword({
    email: "owner-a@cusp-uat.test",
    password: "cusp-uat-password-1",
  });
  const { error: crossErr } = await owner.rpc("book_class", {
    p_class_session_id: aeroLater,
    p_client_id: client1.id,
  });
  check(
    crossErr?.message?.includes("Not allowed"),
    "studio A's owner cannot book on studio B's sessions",
    crossErr?.message
  );
  const { error: crossAttendErr } = await owner.rpc("mark_attendance", {
    p_booking_id: bookNow.booking_id,
    p_present: true,
  });
  check(
    !!crossAttendErr,
    "studio A's owner cannot mark attendance on studio B's bookings"
  );
  await owner.auth.signOut();

  if (failures > 0) {
    console.error(`\n${failures} engine check(s) FAILED`);
    process.exit(1);
  }
  console.log("\nAll credit-engine checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
