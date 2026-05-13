"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { calcBilling, exportBillingCSV, type ClientBillingSummary } from "@/lib/billing-calc";
import {
  ChevronLeft,
  ChevronRight,
  FileDown,
  Loader2,
  BarChart3,
  FileText,
} from "lucide-react";

export default function BillingReportPage() {
  const supabase = createClient();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [facilityId, setFacilityId] = useState<string>("");
  const [facilityName, setFacilityName] = useState<string>("");
  const [summaries, setSummaries] = useState<ClientBillingSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("facility_id, facilities(name)")
        .eq("id", user.id)
        .single();
      setFacilityId(profile?.facility_id ?? "");
      setFacilityName(
        (profile?.facilities as { name?: string } | null)?.name ?? ""
      );
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = useCallback(async () => {
    if (!facilityId) return;
    setLoading(true);

    const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

    const { data } = await supabase
      .from("daily_attendance")
      .select("client_name, attendance, lunch, transport")
      .eq("facility_id", facilityId)
      .gte("recorded_date", monthStart)
      .lt("recorded_date", monthEnd);

    setSummaries(calcBilling(data ?? []));
    setLoading(false);
  }, [facilityId, year, month, supabase]);

  useEffect(() => {
    if (facilityId) fetchData();
  }, [facilityId, fetchData]);

  const prevMonth = () => {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  };
  const nextMonthNav = () => {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  };

  const totals = {
    attendance: summaries.reduce((n, s) => n + s.attendance, 0),
    lunch: summaries.reduce((n, s) => n + s.lunch, 0),
    transportBoth: summaries.reduce((n, s) => n + s.transportBoth, 0),
    transportOne: summaries.reduce((n, s) => n + s.transportOne, 0),
  };

  const handleCSV = () => {
    const csv = exportBillingCSV(summaries, year, month, facilityName);
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `加算集計_${year}年${month}月.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePDF = async () => {
    for (const s of summaries) {
      const res = await fetch("/api/generate-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "service_record",
          clientName: s.clientName,
          facilityId,
          year,
          month,
        }),
      });
      if (!res.ok) continue;
      const blob = await res.blob();
      const cd = res.headers.get("content-disposition") ?? "";
      const m = cd.match(/filename\*=UTF-8''(.+)/);
      const filename = m ? decodeURIComponent(m[1]) : `実績記録票_${s.clientName}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      await new Promise((r) => setTimeout(r, 500));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-2">
          <BarChart3 size={20} className="text-emerald-500" />
          <div>
            <h1 className="text-2xl font-bold text-slate-800">加算・請求集計</h1>
            <p className="text-sm text-slate-500 mt-0.5">出欠データを月次で集計します</p>
          </div>
        </div>
        {/* 月選択 */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center justify-between">
          <button
            onClick={prevMonth}
            className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-500"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-800">
              {year}年{month}月
            </p>
            <p className="text-xs text-slate-400 mt-0.5">集計月</p>
          </div>
          <button
            onClick={nextMonthNav}
            className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-500"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* 加算説明 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "食事提供加算", key: "lunch" as const, color: "bg-emerald-100 text-emerald-700", desc: "昼食:○の日" },
            { label: "送迎加算(往復)", key: "transportBoth" as const, color: "bg-blue-100 text-blue-700", desc: "送迎:○の日" },
            { label: "送迎加算(片道)", key: "transportOne" as const, color: "bg-amber-100 text-amber-700", desc: "送迎:△の日" },
            { label: "出席日数", key: "attendance" as const, color: "bg-slate-100 text-slate-700", desc: "出欠:○/△の日" },
          ].map(({ label, key, color, desc }) => (
            <div key={key} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 text-center">
              <p className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full mb-2 ${color}`}>{label}</p>
              <p className="text-2xl font-bold text-slate-800">{totals[key]}</p>
              <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
            </div>
          ))}
        </div>

        {/* 集計テーブル */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700">利用者別集計</h2>
            <div className="flex gap-2">
              <button
                onClick={handleCSV}
                disabled={summaries.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50 transition-colors"
              >
                <FileDown size={13} />
                CSV出力
              </button>
              <button
                onClick={handlePDF}
                disabled={summaries.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors"
              >
                <FileText size={13} />
                実績記録票PDF
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={22} className="animate-spin text-slate-300" />
            </div>
          ) : summaries.length === 0 ? (
            <p className="text-center py-12 text-slate-400 text-sm">
              {year}年{month}月の出欠データがありません
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-5 py-3 text-left">利用者名</th>
                    <th className="px-4 py-3 text-center">出席日数</th>
                    <th className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                        食事加算
                      </span>
                    </th>
                    <th className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                        送迎往復
                      </span>
                    </th>
                    <th className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                        送迎片道
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summaries.map((s) => (
                    <tr key={s.clientName} className="hover:bg-slate-50">
                      <td className="px-5 py-3.5 font-medium text-slate-800">{s.clientName}</td>
                      <td className="px-4 py-3.5 text-center font-semibold text-slate-700">{s.attendance}</td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="font-semibold text-emerald-700">{s.lunch}</span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="font-semibold text-blue-700">{s.transportBoth}</span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="font-semibold text-amber-700">{s.transportOne}</span>
                      </td>
                    </tr>
                  ))}
                  {/* 合計行 */}
                  <tr className="bg-slate-50 font-bold">
                    <td className="px-5 py-3.5 text-slate-700">合計</td>
                    <td className="px-4 py-3.5 text-center text-slate-800">{totals.attendance}</td>
                    <td className="px-4 py-3.5 text-center text-emerald-700">{totals.lunch}</td>
                    <td className="px-4 py-3.5 text-center text-blue-700">{totals.transportBoth}</td>
                    <td className="px-4 py-3.5 text-center text-amber-700">{totals.transportOne}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* CSV形式の説明 */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-700">
          <p className="font-semibold mb-1">CSV出力について</p>
          <p>出力されるCSVは国保連請求の補助集計データです。正式な請求書は各請求ソフト（恵 / けあシス等）にてご作成ください。</p>
        </div>
      </div>
    </div>
  );
}
