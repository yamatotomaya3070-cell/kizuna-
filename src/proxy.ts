import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  // 未ログインかつログインページ以外にアクセスしたらリダイレクト
  if (!user && pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user) {
    const role = user.user_metadata?.role ?? "facility";

    // ログイン済みでログインページにアクセスしたらロール別トップへ
    if (pathname === "/login") {
      return NextResponse.redirect(
        new URL(role === "admin" ? "/admin" : "/", request.url)
      );
    }

    // admin が / にアクセスしたら /admin へ（戻るボタン対策）
    if (role === "admin" && pathname === "/") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }

    // facility ユーザーが admin 専用ページにアクセスしたら / へ
    const adminOnlyPaths = ["/admin", "/facilities", "/clients", "/status", "/support-plans", "/shifts"];
    if (role === "facility" && adminOnlyPaths.some((p) => pathname.startsWith(p))) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};
