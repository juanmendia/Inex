import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";
import { canAccessPath, homeForRoles, parseRoles, ROLES_COOKIE } from "@/lib/auth/roles";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { supabaseUrl, supabaseAnonKey } = publicEnv();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAction = request.headers.has("next-action") || request.method === "POST";
  const isProtected =
    path.startsWith("/empleado") || path.startsWith("/rrhh") || path.startsWith("/admin");
  const mustChange = Boolean(user?.app_metadata?.must_change_password);
  const claveOk = path === "/login/clave" || path === "/login/nueva-clave";

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const fromCookie = parseRoles(request.cookies.get(ROLES_COOKIE)?.value);
  const fromJwt = user?.app_metadata?.roles;
  const roles = fromCookie.length
    ? fromCookie
    : Array.isArray(fromJwt)
      ? fromJwt.map(String)
      : [];

  if (isAction) return response;

  if (user && mustChange && !claveOk) {
    const url = request.nextUrl.clone();
    url.pathname = "/login/clave";
    return NextResponse.redirect(url);
  }

  if (user && !mustChange && (path === "/login" || path === "/" || path === "/activar")) {
    const url = request.nextUrl.clone();
    url.pathname = homeForRoles(roles);
    return NextResponse.redirect(url);
  }

  if (user && isProtected && !canAccessPath(path, roles)) {
    const url = request.nextUrl.clone();
    url.pathname = homeForRoles(roles);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
