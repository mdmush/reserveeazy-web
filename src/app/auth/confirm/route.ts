import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const redirectUrl = request.nextUrl.clone();

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.delete("code");
      redirectUrl.searchParams.set("verified", "true");
      return NextResponse.redirect(redirectUrl);
    }
  }

  redirectUrl.pathname = "/login";
  redirectUrl.searchParams.delete("code");
  redirectUrl.searchParams.set("error", "invalid_code");
  return NextResponse.redirect(redirectUrl);
}
