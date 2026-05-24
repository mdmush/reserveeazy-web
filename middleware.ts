import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { user, supabase, supabaseResponse } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isAuthRoute =
    pathname.startsWith("/login") || pathname.startsWith("/signup");
  const isProtected =
    pathname.startsWith("/dashboard") || pathname.startsWith("/onboarding");

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && user) {
    const { data: membership } = await supabase
      .from("business_members")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    const url = request.nextUrl.clone();
    url.pathname = membership ? "/dashboard" : "/onboarding";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
