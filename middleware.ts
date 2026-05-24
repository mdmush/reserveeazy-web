import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { user, supabase, supabaseResponse } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isAuthRoute =
    pathname.startsWith("/login") || pathname.startsWith("/signup");
  const isAdminRoute = pathname.startsWith("/admin");
  const isProtected =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/onboarding") ||
    isAdminRoute;

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (isAdminRoute && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_superuser")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.is_superuser) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  if (isAuthRoute && user) {
    const [{ data: membership }, { data: profile }] = await Promise.all([
      supabase
        .from("business_members")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("is_superuser")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

    const url = request.nextUrl.clone();
    if (membership) {
      url.pathname = "/dashboard";
    } else if (profile?.is_superuser) {
      url.pathname = "/admin";
    } else {
      url.pathname = "/onboarding";
    }
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
