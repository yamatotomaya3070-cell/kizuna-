"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Brain,
  Sparkles,
  Loader2,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Target,
  Download,
  ClipboardList,
  FileDown,
  Briefcase,
  Heart,
  UserPlus,
} from "lucide-react";
import Link from "next/link";

type DiaryEntry = {
  id: string;
  recorded_at: string;
  attendance: string;
  role: string | null;
  ratings: Record<string, string>;
  staff_name: string;
};

type MonitoringReport = {
  achievement: string;
  issues: string;
  nextGoal: string;
};

type DayGroup = {
  date: string;
  work: DiaryEntry | null;
  life: DiaryEntry | null;
};

function groupByDateAndRole(diaries: DiaryEntry[]): DayGroup[] {
  const map: Record<string, DayGroup> = {};
  for (const d of diaries) {
    const date = new Date(d.recorded_at).toLocaleDateString("ja-JP", {
      month: "numeric",
      day: "numeric",
      weekday: "short",
    });
    if (!map[date]) map[date] = { date, work: null, life: null };
    const role = d.role ?? (d.ratings?.role as string | undefined) ?? "work";
    if (role === "life") {
      map[date].life = d;
    } else {
      map[date].work = d;
    }
  }
  return Object.values(map);
}

export default function MonitoringPage() {
  const supabase = createClient();
  const [facilityId, setFacilityId] = useState<string | null>(null);
  const [clients, setClients] = useState<string[]>([]);
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [diaries, setDiaries] = useState<DiaryEntry[]>([]);
  const [loadingDiaries, setLoadingDiaries] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [report, setReport] = useState<MonitoringReport | null>(null);
  const [warning, setWarning] = useState("");
  const [allowPartial, setAllowPartial] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("facility_id")
        .eq("id", user.id)
        .single();

      const fid = profile?.facility_id;
      setFacilityId(fid);

      const { data } = await supabase
        .from("clients")
        .select("name")
        .eq("facility_id", fid)
        .eq("status", "active")
        .order("name");
      setClients(data?.map((c) => c.name) ?? []);
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectClient = async (name: string) => {
    setSelectedClient(name);
    setReport(null);
    setWarning("");
    setAllowPartial(false);
    setLoadingDiaries(true);

    const { data } = await supabase
      .from("diaries")
      .select("id, recorded_at, attendance, role, ratings, staff_name")
      .eq("facility_id", facilityId)
      .eq("client_name", name)
      .order("recorded_at", { ascending: false })
      .limit(60);

    setDiaries((data as DiaryEntry[]) ?? []);
    setLoadingDiaries(false);
  };

  const recordedRoleCounts = () => {
    const attended = diaries.filter((d) => d.attendance !== "●");
    return {
      work: attended.filter((d) => (d.role ?? "work") !== "life").length,
      life: attended.filter((d) => (d.role ?? "work") === "life").length,
      total: attended.length,
    };
  };

  const handleGenerate = async () => {
    if (!selectedClient) return;
    const counts = recordedRoleCounts();
    if (counts.total === 0) {
      setWarning("評価記録がありません。職業指導員または生活支援員の日報を記録してから生成してください。");
      return;
    }
    if ((counts.work === 0 || counts.life === 0) && !allowPartial) {
      setWarning("一部の記録のみで生成されます。内容の精度が下がる可能性があります。生成する場合は確認ボタンを押してください。");
      setAllowPartial(true);
      return;
    }
    setGenerating(true);
    setReport(null);
    setWarning("");
    setAllowPartial(false);

    const diaryText = diaries
      .filter((d) => d.attendance !== "●")
      .map((d) => {
        const date = new Date(d.recorded_at).toLocaleDateString("ja-JP");
        const roleLabel =
          (d.role ?? "work") === "life" ? "生活支援員" : "職業指導員";
        const comment = d.ratings?.eval ?? "";
        return `${date}（${d.staff_name}・${roleLabel}）: ${comment}`;
      })
      .join("\n");

    try {
      const res = await fetch("/api/generate-monitoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userName: selectedClient, diaryEntries: diaryText }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setReport(data);
    } catch {
      alert("生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  };

  const handleExportCSV = () => {
    if (!selectedClient || diaries.length === 0) return;
    const header = ["日付", "役職", "利用者", "出欠", "スタッフ", "コメント"];
    const rows = diaries.map((d) => {
      const roleLabel = (d.role ?? "work") === "life" ? "生活支援員" : "職業指導員";
      return [
        new Date(d.recorded_at).toLocaleDateString("ja-JP"),
        roleLabel,
        selectedClient,
        d.attendance,
        d.staff_name,
        `"${(d.ratings?.eval ?? "").replace(/"/g, '""')}"`,
      ];
    });
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `日報_${selectedClient}_${new Date().toLocaleDateString("ja-JP").replace(/\//g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = async () => {
    if (!selectedClient || !report || !facilityId) return;
    setPdfGenerating(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const res = await fetch("/api/generate-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "monitoring_report",
          clientName: selectedClient,
          facilityId,
          periodStart: sixMonthsAgo.toISOString().slice(0, 10),
          periodEnd: today,
          additionalData: {
            preGenerated: {
              achievement: report.achievement,
              issues: report.issues,
              nextGoal: report.nextGoal,
            },
          },
        }),
      });
      if (!res.ok) throw new Error("PDF生成失敗");
      const blob = await res.blob();
      const cd = res.headers.get("content-disposition") ?? "";
      const m = cd.match(/filename\*=UTF-8''(.+)/);
      const filename = m ? decodeURIComponent(m[1]) : `モニタリング報告書_${selectedClient}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("PDF生成に失敗しました");
    } finally {
      setPdfGenerating(false);
    }
  };

  const attendedCount = diaries.filter((d) => d.attendance !== "●").length;
  const dayGroups = groupByDateAndRole(diaries);
  const counts = recordedRoleCounts();

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3">
        <Brain size={22} className="text-indigo-500" />
        <div>
          <h2 className="text-2xl font-bold text-slate-800">AIモニタリング評価</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            職業指導員・生活支援員の2名評価をもとに個別支援計画モニタリングを自動生成します
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* 左：利用者リスト */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-700">利用者を選択</h3>
          </div>
          {clients.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-400">
              <p>利用者が登録されていません</p>
              <Link
                href="/clients"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-700"
              >
                <UserPlus size={14} />
                利用者管理から利用者を登録してください
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {clients.map((name) => {
                const active = selectedClient === name;
                return (
                  <li key={name}>
                    <button
                      onClick={() => selectClient(name)}
                      className={`w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors ${
                        active ? "bg-indigo-50" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        active ? "bg-indigo-500 text-white" : "bg-slate-100 text-slate-500"
                      }`}>
                        {name[0]}
                      </div>
                      <span className={`text-sm font-medium flex-1 ${active ? "text-indigo-700" : "text-slate-700"}`}>
                        {name}
                      </span>
                      {active && <ChevronRight size={15} className="text-indigo-400 shrink-0" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* 右：日報 + 生成 */}
        <div className="xl:col-span-2 space-y-4">
          {!selectedClient ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center justify-center py-24 text-slate-400 text-sm">
              左から利用者を選択してください
            </div>
          ) : (
            <>
              {/* 日報サマリー */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ClipboardList size={16} className="text-blue-500" />
                    <h3 className="text-sm font-bold text-slate-700">
                      {selectedClient}さんの日報記録
                    </h3>
                    <span className="text-xs text-slate-400">
                      {diaries.length}件（出席 {attendedCount}日）
                    </span>
                  </div>
                  {diaries.length > 0 && (
                    <button
                      onClick={handleExportCSV}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                    >
                      <FileDown size={13} />
                      CSV
                    </button>
                  )}
                </div>

                {loadingDiaries ? (
                  <div className="flex justify-center py-10">
                    <Loader2 size={22} className="animate-spin text-slate-300" />
                  </div>
                ) : diaries.length === 0 ? (
                  <p className="text-center py-10 text-slate-400 text-sm">日報がまだありません</p>
                ) : (
                  <div className="max-h-64 overflow-y-auto">
                    {/* ロール凡例 */}
                    <div className="flex gap-4 px-5 py-2 bg-slate-50 border-b border-slate-100">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-blue-700">
                        <Briefcase size={11} />
                        職業指導員
                      </span>
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700">
                        <Heart size={11} />
                        生活支援員
                      </span>
                    </div>

                    {/* 日付ごとのwork/lifeペア */}
                    {dayGroups.map((g) => (
                      <div key={g.date} className="border-b border-slate-100 last:border-0">
                        <div className="px-5 py-1.5 bg-slate-50 text-xs font-semibold text-slate-500">
                          {g.date}
                        </div>
                        <div className="grid grid-cols-2 divide-x divide-slate-100">
                          {/* 職業指導員 */}
                          <div className="px-4 py-2.5">
                            {g.work ? (
                              g.work.attendance === "●" ? (
                                <span className="text-xs text-slate-300">欠席</span>
                              ) : (
                                <>
                                  <p className="text-xs text-blue-700 font-semibold mb-0.5 flex items-center gap-1">
                                    <Briefcase size={10} />
                                    {g.work.staff_name}
                                  </p>
                                  <p className="text-xs text-slate-600 leading-snug line-clamp-2">
                                    {g.work.ratings?.eval ?? "（コメントなし）"}
                                  </p>
                                </>
                              )
                            ) : (
                              <span className="text-xs text-slate-300">未記録</span>
                            )}
                          </div>
                          {/* 生活支援員 */}
                          <div className="px-4 py-2.5">
                            {g.life ? (
                              g.life.attendance === "●" ? (
                                <span className="text-xs text-slate-300">欠席</span>
                              ) : (
                                <>
                                  <p className="text-xs text-indigo-700 font-semibold mb-0.5 flex items-center gap-1">
                                    <Heart size={10} />
                                    {g.life.staff_name}
                                  </p>
                                  <p className="text-xs text-slate-600 leading-snug line-clamp-2">
                                    {g.life.ratings?.eval ?? "（コメントなし）"}
                                  </p>
                                </>
                              )
                            ) : (
                              <span className="text-xs text-slate-300">未記録</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 生成ボタン */}
              {warning && (
                <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
                  allowPartial ? "border-amber-200 bg-amber-50 text-amber-700" : "border-red-200 bg-red-50 text-red-700"
                }`}>
                  {warning}
                </div>
              )}
              {diaries.length > 0 && (
                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  <span className={`rounded-full px-2.5 py-1 ${counts.work > 0 ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
                    職業指導員: {counts.work > 0 ? "記録あり" : "未記録"}
                  </span>
                  <span className={`rounded-full px-2.5 py-1 ${counts.life > 0 ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"}`}>
                    生活支援員: {counts.life > 0 ? "記録あり" : "未記録"}
                  </span>
                </div>
              )}
              <button
                onClick={handleGenerate}
                disabled={generating || counts.total === 0}
                className={`w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl font-bold text-sm transition-all ${
                  generating || counts.total === 0
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-md"
                }`}
              >
                {generating ? (
                  <><Loader2 size={18} className="animate-spin" />AIが日報を解析中...</>
                ) : (
                  <><Sparkles size={18} />{allowPartial ? "確認してAI生成する" : `${selectedClient}さんのモニタリング評価をAI生成`}</>
                )}
              </button>

              {/* 生成結果 */}
              {report && (
                <div className="bg-white rounded-2xl border border-indigo-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-3.5 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
                    <Sparkles size={14} className="text-indigo-500" />
                    <span className="text-xs font-bold text-indigo-700">
                      AI生成 — {selectedClient}さん　個別支援計画モニタリング評価案
                    </span>
                    <span className="ml-auto text-xs text-indigo-400">内容を確認の上ご活用ください</span>
                  </div>
                  <div className="p-5 space-y-5">
                    <ReportBlock icon={TrendingUp} label="達成度・成長" color="emerald" content={report.achievement} />
                    <ReportBlock icon={AlertCircle} label="課題・支援ポイント" color="amber" content={report.issues} />
                    <ReportBlock icon={Target} label="次期目標案" color="blue" content={report.nextGoal} />
                  </div>
                  <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                    <button
                      onClick={handleExportPDF}
                      disabled={pdfGenerating}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 transition-colors"
                    >
                      {pdfGenerating ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Download size={13} />
                      )}
                      PDF出力
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ReportBlock({
  icon: Icon,
  label,
  color,
  content,
}: {
  icon: React.ElementType;
  label: string;
  color: "emerald" | "amber" | "blue";
  content: string;
}) {
  const styles = {
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
  };
  return (
    <div>
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-2 ${styles[color]}`}>
        <Icon size={12} />
        {label}
      </span>
      <p className="text-sm text-slate-700 leading-relaxed">{content}</p>
    </div>
  );
}
