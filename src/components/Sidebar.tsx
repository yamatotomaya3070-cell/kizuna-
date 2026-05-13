"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  BookOpen,
  Sparkles,
  FolderOpen,
  ShieldCheck,
  ScrollText,
  type LucideIcon,
} from "lucide-react";
import { navItems } from "@/data/mock";

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Building2,
  BookOpen,
  Sparkles,
  FolderOpen,
  ShieldCheck,
  ScrollText,
};

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 min-h-screen bg-slate-800 text-white flex flex-col">
      {/* ロゴ / サービス名 */}
      <div className="px-6 py-5 border-b border-slate-700">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-1">
          福祉行政
        </p>
        <h1 className="text-lg font-bold leading-tight">タスク管理システム</h1>
      </div>

      {/* ナビゲーション */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = iconMap[item.icon];
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-900 text-white"
                  : "text-slate-300 hover:bg-slate-700 hover:text-white"
              }`}
            >
              {Icon && <Icon size={18} />}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* フッター */}
      <div className="px-5 py-4 border-t border-slate-700 text-xs text-slate-500">
        合同会社絆 © 2026
      </div>
    </aside>
  );
}
