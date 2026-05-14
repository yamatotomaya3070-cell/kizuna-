import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * 3層ロール:
 *  - admin         : SaaSオーナー。全施設横断管理ページにアクセス可
 *  - facility_admin: 施設管理者（サビ管・施設長）。自施設の日報閲覧／帳票生成／計画書管理
 *  - facility      : 施設従業員（現場職員）。日報入力中心
 */
type Role = "admin" | "facility_admin" | "facility";

const SAAS_ADMIN_ONLY = [
  "/admin",
  "/facilities",
  "/billing", // プラン・課金（Stripe等）
];

// facility_admin と admin が見られる（facility は弾く）
const FACILITY_ADMIN_OR_ABOVE = [
  "/facility",           // 事業所長専用ダッシュボード（サイドバーで遷移）
  "/dashboard",
  "/clients",
  "/attendance",
  "/shifts",
  "/status",
  "/support-plans",
  "/monitoring",
  "/billing-report",
  "/documents",
  "/documents/generate",
  "/settings",
];

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

  if (!user && pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user) {
    const rawRole = (user.user_metadata?.role as string | undefined) ?? "facility";
    const role: Role =
      rawRole === "admin" ? "admin"
        : rawRole === "facility_admin" ? "facility_admin"
        : "facility";

    // ログイン済みでログインページに来たらロール別トップへ
    if (pathname === "/login") {
      const target =
        role === "admin" ? "/admin"
          : role === "facility_admin" ? "/facility/dashboard"
            : "/diary";
      return NextResponse.redirect(new URL(target, request.url));
    }

    // admin が / にアクセスしたら /admin へ
    if (role === "admin" && pathname === "/") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    // facility_admin が / にアクセスしたら /facility/dashboard へ
    if (role === "facility_admin" && pathname === "/") {
      return NextResponse.redirect(new URL("/facility/dashboard", request.url));
    }

    // SaaS管理ページ: admin のみ可
    if (role !== "admin" && SAAS_ADMIN_ONLY.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    // facility_admin / admin のみ可（facility は弾く）
    if (
      role === "facility" &&
      FACILITY_ADMIN_OR_ABOVE.some((p) => pathname === p || pathname.startsWith(`${p}/`))
    ) {
      return NextResponse.redirect(new URL("/diary", request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};
