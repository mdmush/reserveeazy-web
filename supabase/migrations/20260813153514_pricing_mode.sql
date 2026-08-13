-- Per-studio pricing mode (FSD v0.6 §2): configuration, not a code branch.
-- 'simple' = the existing slot-booking build (mode A); 'pay_per_class' (B) and
-- 'credits' (C) gate membership features that ship later.
-- CHECK constraint instead of an enum type: cheaper to extend.

alter table public.businesses
  add column pricing_mode text not null default 'simple'
  constraint businesses_pricing_mode_check
  check (pricing_mode in ('simple', 'pay_per_class', 'credits'));
