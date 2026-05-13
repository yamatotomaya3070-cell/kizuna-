"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { SERVICE_TYPE_LABELS, type ServiceType } from "@/data/service-formats";
import { Building2, Loader2, CalendarDays } from "lucide-react";

type Facility = {
  id: string;
  name: string;
  service_type: ServiceType;
  created_at: string;
  diary_count: number;
};

function SummaryCard({ label, value, sub, color }: { label: string; value: number; sub: string; color: string }) {
  return (
    <div className={`bg-white rounded-xl p-4 border-l-4 shadow-sm ${color}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-3xl font-bold text-slate-800 mt-0.5">{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
    </div>
  );
}

export default function AdminPage() {
  const supabase = createClient();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      // 施設一覧
      const { data: facs } = await supabase
        .from("facilities")
        .select("id, name, service_type, created_at")
        .order("created_at", { ascending: false });

      if (!facs) { setLoading(false); return; }

      // 当月の日報件数を施設ごとに取得
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

      const withCount: Facility[] = await Promise.all(
        facs.map(async (f) => {
          const { count } = await supabase
            .from("diaries")
            .select("id", { count: "exact", head: true })
            .eq("facility_id", f.id)
            .gte("recorded_at", monthStart);
          return { ...f, diary_count: count ?? 0 };
        })
      );

      setFacilities(withCount);
      setLoading(false);
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = facilities.length;
  const activeThisMonth = facilities.filter((f) => f.diary_count > 0).length;
  const inactiveCount = total - activeThisMonth;

  return (
    <div className="p-8 space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">SaaS管理画面</h2>
        <p className="text-sm text-slate-500 mt-1">契約中の全事業所を一元管理します</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 size={28} className="animate-spin text-slate-300" />
        </div>
      ) : (
        <>
          {/* サマリー */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <SummaryCard label="契約事業所数" value={total} sub="登録済み" color="border-blue-400" />
            <SummaryCard label="今月稼働中" value={activeThisMonth} sub="日報入力あり" color="border-blue-400" />
            <SummaryCard label="未稼働" value={inactiveCount} sub="今月入力なし" color="border-slate-400" />
            <SummaryCard label="今月の日報合計" value={facilities.reduce((n, f) => n + f.diary_count, 0)} sub="全施設合計" color="border-blue-400" />
          </div>

          {/* 施設一覧 */}
          <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
            {facilities.length === 0 ? (
              <div className="py-24 text-center text-slate-400 text-sm">
                <Building2 size={32} className="mx-auto mb-3 text-slate-200" />
                <p>事業所が登録されていません</p>
                <p className="text-xs mt-1">「事業所管理」から新規事業所を追加してください</p>
              </div>
            ) : (
              <table className="w-full text-sm min-w-[640px]">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-6 py-3 text-left">事業所名</th>
                    <th className="px-6 py-3 text-left">事業種別</th>
                    <th className="px-6 py-3 text-left">登録日</th>
                    <th className="px-6 py-3 text-center">今月の日報件数</th>
                    <th className="px-6 py-3 text-center">稼働状況</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {facilities.map((f) => {
                    const active = f.diary_count > 0;
                    return (
                      <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                              <Building2 size={14} className="text-blue-900" />
                            </div>
                            <span className="font-medium text-slate-800">{f.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-500 text-xs">
                          {SERVICE_TYPE_LABELS[f.service_type] ?? f.service_type}
                        </td>
                        <td className="px-6 py-4 text-slate-500 text-xs">
                          <div className="flex items-center gap-1.5">
                            <CalendarDays size={12} />
                            {new Date(f.created_at).toLocaleDateString("ja-JP")}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`text-sm font-bold ${f.diary_count > 0 ? "text-blue-900" : "text-slate-300"}`}>
                            {f.diary_count}件
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full ${
                            active
                              ? "bg-blue-100 text-blue-900"
                              : "bg-slate-100 text-slate-500"
                          }`}>
                            {active ? "稼働中" : "未稼働"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
