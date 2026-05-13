"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  FileText,
  Loader2,
  Download,
  User,
  ClipboardList,
  BarChart3,
  CalendarDays,
  Sparkles,
  CheckCircle2,
  UserPlus,
} from "lucide-react";

type DocType = "support_plan" | "monitoring_report" | "service_record";

const DOC_TYPES: {
  id: DocType;
  label: string;
  sub: string;
  icon: React.ElementType;
  color: string;
}[] = [
  {
    id: "support_plan",
    label: "個別支援計画書",
    sub: "半年ごとに作成する支援計画書",
    icon: ClipboardList,
    color: "blue",
  },
  {
    id: "monitoring_report",
    label: "モニタリング報告書",
    sub: "AI生成の評価を正式帳票化",
    icon: Sparkles,
    color: "indigo",
  },
  {
    id: "service_record",
    label: "サービス提供実績記録票",
    sub: "月次の出欠・サービス記録",
    icon: CalendarDays,
    color: "emerald",
  },
];

const COLOR = {
  blue: {
    card: "border-blue-200 bg-blue-50",
    active: "border-blue-900 bg-blue-50 ring-2 ring-blue-300",
    icon: "text-blue-900",
    btn: "bg-blue-900 hover:bg-blue-900",
    badge: "bg-blue-100 text-blue-900",
  },
  indigo: {
    card: "border-blue-200 bg-blue-50",
    active: "border-blue-900 bg-blue-50 ring-2 ring-blue-300",
    icon: "text-blue-900",
    btn: "bg-blue-900 hover:bg-blue-900",
    badge: "bg-blue-100 text-blue-900",
  },
  emerald: {
    card: "border-blue-200 bg-blue-50",
    active: "border-blue-900 bg-blue-50 ring-2 ring-blue-300",
    icon: "text-blue-900",
    btn: "bg-blue-900 hover:bg-blue-900",
    badge: "bg-blue-100 text-blue-900",
  },
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
      {children}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent bg-white ${props.className ?? ""}`}
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent bg-white resize-none ${props.className ?? ""}`}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white ${props.className ?? ""}`}
    />
  );
}

export default function GenerateDocumentPage() {
  const supabase = createClient();

  const [facilityId, setFacilityId] = useState<string>("");
  const [clients, setClients] = useState<string[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [docType, setDocType] = useState<DocType>("support_plan");
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState("");

  const [periodStart, setPeriodStart] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [periodEnd, setPeriodEnd] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    return d.toISOString().slice(0, 10);
  });

  const [wish, setWish] = useState("");
  const [longTermGoal, setLongTermGoal] = useState("");
  const [shortTermGoals, setShortTermGoals] = useState(["", "", ""]);
  const [supportContent, setSupportContent] = useState("");
  const [achievementCriteria, setAchievementCriteria] = useState("");
  const [creatorName, setCreatorName] = useState("");
  const [managerName, setManagerName] = useState("");

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("facility_id")
        .eq("id", user.id)
        .single();
      const fid = profile?.facility_id ?? "";
      setFacilityId(fid);
      const { data } = await supabase
        .from("clients")
        .select("name")
        .eq("facility_id", fid)
        .eq("status", "active")
        .order("name");
      const names = data?.map((c) => c.name) ?? [];
      setClients(names);
      if (names.length > 0) setSelectedClient(names[0]);
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  };

  const handleGenerate = async () => {
    if (!selectedClient) {
      showToast("利用者を選択してください");
      return;
    }
    setGenerating(true);

    let body: Record<string, unknown>;

    if (docType === "support_plan") {
      body = {
        type: "support_plan",
        clientName: selectedClient,
        facilityId,
        periodStart,
        periodEnd,
        additionalData: {
          wish,
          longTermGoal,
          shortTermGoals: shortTermGoals.filter(Boolean),
          supportContent,
          achievementCriteria,
          creatorName,
        },
      };
    } else if (docType === "monitoring_report") {
      body = {
        type: "monitoring_report",
        clientName: selectedClient,
        facilityId,
        periodStart,
        periodEnd,
        additionalData: { managerName },
      };
    } else {
      body = {
        type: "service_record",
        clientName: selectedClient,
        facilityId,
        year,
        month,
      };
    }

    try {
      const res = await fetch("/api/generate-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "生成失敗");
      }

      const blob = await res.blob();
      const contentDisposition = res.headers.get("content-disposition") ?? "";
      const filenameMatch = contentDisposition.match(/filename\*=UTF-8''(.+)/);
      const filename = filenameMatch
        ? decodeURIComponent(filenameMatch[1])
        : `document.pdf`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      showToast("PDFを生成しました");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  };

  const active = DOC_TYPES.find((d) => d.id === docType)!;
  const c = COLOR[active.color as keyof typeof COLOR];

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* トースト */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-slate-800 text-white text-sm font-semibold px-4 py-3 rounded-xl shadow-lg">
          <CheckCircle2 size={16} className="text-blue-400" />
          {toast}
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-2">
          <FileText size={20} className="text-blue-900" />
          <div>
            <h1 className="text-2xl font-bold text-slate-800">帳票自動生成</h1>
            <p className="text-sm text-slate-500 mt-0.5">利用者マスタの利用中の利用者から帳票を生成します</p>
          </div>
        </div>
        {/* 利用者選択 */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <User size={15} className="text-blue-900" />
            <h2 className="text-sm font-bold text-slate-700">利用者を選択</h2>
          </div>
          <div className="p-5">
            {clients.length === 0 ? (
              <div className="text-sm text-slate-400">
                <p>利用者が登録されていません</p>
                <Link
                  href="/clients"
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-900"
                >
                  <UserPlus size={14} />
                  利用者管理から利用者を登録してください
                </Link>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {clients.map((name) => (
                  <button
                    key={name}
                    onClick={() => setSelectedClient(name)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                      selectedClient === name
                        ? "bg-blue-900 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {clients.length > 0 && (
        <>
        {/* 帳票種類 */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <BarChart3 size={15} className="text-blue-900" />
            <h2 className="text-sm font-bold text-slate-700">帳票の種類</h2>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {DOC_TYPES.map((dt) => {
              const dc = COLOR[dt.color as keyof typeof COLOR];
              const isActive = docType === dt.id;
              const Icon = dt.icon;
              return (
                <button
                  key={dt.id}
                  onClick={() => setDocType(dt.id)}
                  className={`flex flex-col items-start gap-2 p-4 rounded-xl border text-left transition-all ${
                    isActive ? dc.active : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <Icon size={18} className={isActive ? dc.icon : "text-slate-400"} />
                  <div>
                    <p className={`text-xs font-bold ${isActive ? "text-slate-800" : "text-slate-600"}`}>
                      {dt.label}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-snug">{dt.sub}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 入力フォーム */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className={`px-5 py-4 border-b flex items-center gap-2 ${
            docType === "support_plan"
              ? "bg-blue-50 border-blue-100"
              : docType === "monitoring_report"
              ? "bg-blue-50 border-blue-100"
              : "bg-blue-50 border-blue-100"
          }`}>
            <active.icon size={15} className={c.icon} />
            <h2 className="text-sm font-bold text-slate-700">{active.label} — 入力項目</h2>
          </div>
          <div className="p-5 space-y-5">
            {/* 共通：対象期間 */}
            {(docType === "support_plan" || docType === "monitoring_report") && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>対象期間（開始）</Label>
                  <Input
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                  />
                </div>
                <div>
                  <Label>対象期間（終了）</Label>
                  <Input
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* 個別支援計画書 */}
            {docType === "support_plan" && (
              <>
                <div>
                  <Label>本人の希望・ニーズ</Label>
                  <Textarea
                    rows={3}
                    placeholder="例：一般就労を目指したい。人との関わりを増やしたい。"
                    value={wish}
                    onChange={(e) => setWish(e.target.value)}
                  />
                </div>
                <div>
                  <Label>長期目標</Label>
                  <Textarea
                    rows={2}
                    placeholder="例：就労継続支援B型において安定した作業遂行を実現し、一般就労への移行を目指す。"
                    value={longTermGoal}
                    onChange={(e) => setLongTermGoal(e.target.value)}
                  />
                </div>
                <div>
                  <Label>短期目標</Label>
                  <div className="space-y-2">
                    {shortTermGoals.map((g, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-sm font-bold text-slate-400 mt-2 w-5 shrink-0">
                          {["①", "②", "③"][i]}
                        </span>
                        <Input
                          placeholder={`短期目標 ${i + 1}`}
                          value={g}
                          onChange={(e) => {
                            const next = [...shortTermGoals];
                            next[i] = e.target.value;
                            setShortTermGoals(next);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>支援内容</Label>
                  <Textarea
                    rows={3}
                    placeholder="例：作業支援（木工・軽作業）、生活支援、コミュニケーション訓練"
                    value={supportContent}
                    onChange={(e) => setSupportContent(e.target.value)}
                  />
                </div>
                <div>
                  <Label>達成基準</Label>
                  <Textarea
                    rows={2}
                    placeholder="例：週4日以上安定して通所できること、作業時間が2時間以上継続できること"
                    value={achievementCriteria}
                    onChange={(e) => setAchievementCriteria(e.target.value)}
                  />
                </div>
                <div>
                  <Label>作成者名（サービス管理責任者）</Label>
                  <Input
                    placeholder="例：田中 花子"
                    value={creatorName}
                    onChange={(e) => setCreatorName(e.target.value)}
                  />
                </div>
              </>
            )}

            {/* モニタリング報告書 */}
            {docType === "monitoring_report" && (
              <>
                <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 text-sm text-blue-900">
                  <div className="flex items-center gap-2 font-semibold mb-1">
                    <Sparkles size={14} />
                    AI自動生成
                  </div>
                  <p className="text-xs text-blue-900">
                    対象期間内の日報データをもとに、Gemini AIが「達成度・課題・次期目標」を自動生成して帳票に反映します。
                  </p>
                </div>
                <div>
                  <Label>サービス管理責任者名</Label>
                  <Input
                    placeholder="例：田中 花子"
                    value={managerName}
                    onChange={(e) => setManagerName(e.target.value)}
                  />
                </div>
              </>
            )}

            {/* 実績記録票 */}
            {docType === "service_record" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>年</Label>
                  <Select
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                  >
                    {[today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1].map((y) => (
                      <option key={y} value={y}>{y}年</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>月</Label>
                  <Select
                    value={month}
                    onChange={(e) => setMonth(Number(e.target.value))}
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>{m}月</option>
                    ))}
                  </Select>
                </div>
                <div className="col-span-2 text-xs text-slate-500 bg-slate-50 rounded-xl p-3">
                  出欠・昼食・送迎データは出欠入力画面で登録されたデータを自動読み込みします。
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 生成ボタン */}
        <button
          onClick={handleGenerate}
          disabled={generating || !selectedClient}
          className={`w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl font-bold text-sm transition-all ${
            generating || !selectedClient
              ? "bg-slate-200 text-slate-400 cursor-not-allowed"
              : `${c.btn} text-white shadow-md hover:shadow-lg active:scale-[0.98]`
          }`}
        >
          {generating ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              {docType === "monitoring_report" ? "AIが日報を解析・PDF生成中..." : "PDF生成中..."}
            </>
          ) : (
            <>
              <Download size={18} />
              {selectedClient ? `${selectedClient}さんの${active.label}を生成` : "利用者を選択してください"}
            </>
          )}
        </button>
        </>
        )}
      </div>
    </div>
  );
}
