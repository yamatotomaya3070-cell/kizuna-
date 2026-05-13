"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Brain,
  Building2,
  CalendarCheck,
  CalendarRange,
  CreditCard,
  FileDown,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Users,
} from "lucide-react";
import { logout } from "@/app/actions/auth";

const ADMIN_NAV = [
  { href: "/admin", label: "SaaS管理", icon: ShieldCheck },
  { href: "/facilities", label: "事業所管理", icon: Building2 },
  { href: "/clients", label: "利用者管理", icon: Users },
  { href: "/dashboard", label: "施設ダッシュボード", icon: LayoutDashboard },
  { href: "/attendance", label: "出欠入力", icon: CalendarCheck },
  { href: "/shifts", label: "シフト管理", icon: CalendarRange },
  { href: "/status", label: "入力状況", icon: Activity },
  { href: "/monitoring", label: "モニタリング評価", icon: Brain },
  { href: "/billing-report", label: "加算・請求集計", icon: BarChart3 },
  { href: "/documents/generate", label: "帳票自動生成", icon: FileDown },
  { href: "/billing", label: "プラン・課金", icon: CreditCard },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      <nav className="sticky top-0 z-40 bg-white border-b border-slate-200 md:h-screen md:w-56 md:shrink-0 md:border-b-0 md:border-r md:flex md:flex-col">
        <div className="px-4 py-4 border-b border-slate-100">
          <p className="text-xs font-bold text-blue-900 uppercase tracking-wide">管理画面</p>
          <p className="text-xs text-slate-500 mt-0.5">合同会社絆</p>
        </div>

        <div className="flex gap-1 overflow-x-auto p-3 md:flex-1 md:flex-col md:overflow-x-visible md:space-y-1">
          {ADMIN_NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`));
            return (
              <Link
                key={href}
                href={href}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors ${
                  active
                    ? "bg-blue-900 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                }`}
              >
                <Icon size={15} />
                <span className="whitespace-nowrap">{label}</span>
              </Link>
            );
          })}
        </div>

        <div className="hidden px-3 pb-4 md:block">
          <form
            action="#"
            onSubmit={async (e) => {
              e.preventDefault();
              await logout();
            }}
          >
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <LogOut size={14} />
              ログアウト
            </button>
          </form>
        </div>
      </nav>

      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
