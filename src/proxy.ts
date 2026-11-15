import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Refreshes the Supabase session cookie and redirects logged-out protected routes. */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();

  const pathname = request.nextUrl.pathname;
  const protectedAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");
  const protectedDashboardPath = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const publicAdminLogin = pathname === "/admin/login";

  if (!data?.claims && ((protectedAdminPath && !publicAdminLogin) || protectedDashboardPath)) {
    const url = request.nextUrl.clone();
    url.pathname = protectedAdminPath ? "/admin/login" : "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*", "/api/auth/:path*", "/api/incidents/:path*", "/api/review-queue", "/api/areas", "/api/teams", "/api/reports/:id/review"],
};
