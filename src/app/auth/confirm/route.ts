import { type NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/app-url";

const OTP_TYPES: EmailOtpType[] = [
  "email",
  "magiclink",
  "signup",
  "recovery",
  "invite",
  "email_change",
];

/**
 * Only follow same-origin internal paths — never external URLs. Absolute URLs
 * are accepted when their origin matches the app and reduced to path+query.
 */
function sanitizeNext(raw: string | null): string | null {
  if (!raw) return null;
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  try {
    const url = new URL(raw);
    if (url.origin === new URL(getAppUrl()).origin) {
      return url.pathname + url.search;
    }
  } catch {
    // not a URL — fall through
  }
  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = sanitizeNext(searchParams.get("next"));

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.search = "";

  const succeed = () => {
    if (next) {
      redirectUrl.pathname = next.split("?")[0];
      redirectUrl.search = next.includes("?") ? next.slice(next.indexOf("?")) : "";
    } else {
      // Historical behavior: land on /login; middleware routes signed-in
      // users onward, and the verified modal handles the password flow.
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("verified", "true");
    }
    return NextResponse.redirect(redirectUrl);
  };
  const fail = () => {
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    redirectUrl.searchParams.set("error", "invalid_code");
    return NextResponse.redirect(redirectUrl);
  };

  const supabase = await createClient();

  // token_hash links (magic link / OTP emails) verify without the PKCE
  // cookie, so they work even when opened in a different browser.
  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    return error ? fail() : succeed();
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return error ? fail() : succeed();
  }

  return fail();
}
