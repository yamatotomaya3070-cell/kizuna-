"use client";

/**
 * 帳票自動生成画面：クライアントのExcelテンプレート（業務日報 / 個別支援計画 / モニタリング）
 * の項目構造に合わせてフォームを用意し、フォーム送信で .xlsx を直接ダウンロードする。
 */

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  FileText,
  Loader2,
  Download,
  Save,
  User,
  ClipboardList,
  CalendarDays,
  Sparkles,
  CheckCircle2,
  UserPlus,
} from "lucide-react";
import { saveSupportPlan, getSupportPlan } from "@/app/actions/support-plans";

type DocType = "diary" | "support_plan" | "monitoring";

const DOC_TYPES: {
  id: DocType;
  label: string;
  sub: string;
  icon: React.ElementType;
}[] = [
  {
    id: "diary",
    label: "業務日報",
    sub: "1日分・利用者全員を1ページにまとめた業務日誌Excel",
    icon: CalendarDays,
  },
  {
    id: "support_plan",
    label: "個別支援計画書",
    sub: "半年単位で作成する支援計画書Excel",
    icon: ClipboardList,
  },
  {
    id: "monitoring",
    label: "モニタリング・評価記録表",
    sub: "個別支援計画とセットで評価するモニタリングExcel",
    icon: Sparkles,
  },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function addMonthsISO(iso: string, months: number) {
  const d = new Date(iso + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-slate-700 mb-1.5">{children}</label>;
}
function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-blue-900 bg-white ${props.className ?? ""}`}
    />
  );
}
function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full px-3 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-blue-900 bg-white resize-none ${props.className ?? ""}`}
    />
  );
}

type Goal = {
  priority: number;
  specific_goal: string;
  user_role: string;
  support_content: string;
  support_duration: string;
};

type Eval = {
  user_hope: string;
  user_role: string;
  support_content: string;
  remaining_issue: string;
  evaluation: "A" | "B" | "C" | "";
};

export default function GenerateDocumentPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-500">読み込み中...</div>}>
      <GenerateDocumentInner />
    </Suspense>
  );
}

function GenerateDocumentInner() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const initialType = (searchParams.get("type") as DocType | null) ?? "diary";
  const planIdParam = searchParams.get("planId");

  const [clients, setClients] = useState<string[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [docType, setDocType] = useState<DocType>(initialType);
  const [planId, setPlanId] = useState<string | null>(planIdParam);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  // ── 業務日報用
  const [diaryDate, setDiaryDate] = useState<string>(todayISO());

  // ── 個別支援計画用（Excelのヘッダ・3目標表に対応）
  const [planStart, setPlanStart] = useState<string>(todayISO());
  const [planEnd, setPlanEnd] = useState<string>(addMonthsISO(todayISO(), 6));
  const [authorName, setAuthorName] = useState("");
  const [serviceManagerName, setServiceManagerName] = useState("");
  const [createdDate, setCreatedDate] = useState<string>(todayISO());
  const [attainmentGoal, setAttainmentGoal] = useState("");
  const [overallPolicy, setOverallPolicy] = useState("");
  const [longTermGoal, setLongTermGoal] = useState("");
  const [shortTermGoal, setShortTermGoal] = useState("");
  const [goals, setGoals] = useState<Goal[]>([
    { priority: 1, specific_goal: "", user_role: "", support_content: "", support_duration: "6か月\n開所日" },
    { priority: 2, specific_goal: "", user_role: "", support_content: "", support_duration: "6か月\n開所日" },
    { priority: 3, specific_goal: "", user_role: "", support_content: "", support_duration: "6か月\n通所日" },
  ]);

  // ── モニタリング用（個別支援計画の各目標に対する評価）
  const [monUserHope, setMonUserHope] = useState("");
  const [monLongTerm, setMonLongTerm] = useState("");
  const [monShortTerm, setMonShortTerm] = useState("");
  const [evals, setEvals] = useState<Eval[]>([
    { user_hope: "", user_role: "", support_content: "", remaining_issue: "", evaluation: "" },
    { user_hope: "", user_role: "", support_content: "", remaining_issue: "", evaluation: "" },
    { user_hope: "", user_role: "", support_content: "", remaining_issue: "", evaluation: "" },
  ]);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("facility_id").eq("id", user.id).single();
      const fid = profile?.facility_id ?? "";
      const { data } = await supabase
        .from("clients")
        .select("name, status")
        .eq("facility_id", fid)
        .order("name");
      const names = (data ?? []).filter((c) => (c.status ?? "active") !== "left").map((c) => c.name);
      setClients(names);
      if (names.length > 0) setSelectedClient(names[0]);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 既存の計画書を読み込み（編集モード）
  useEffect(() => {
    if (!planIdParam) return;
    (async () => {
      const { data, error } = await getSupportPlan(planIdParam);
      if (error || !data) return;
      setDocType("support_plan");
      setPlanId(data.id);
      setSelectedClient(data.client_name);
      setPlanStart(data.plan_start_date);
      setPlanEnd(data.plan_end_date);
      setAuthorName(data.author_name ?? "");
      setServiceManagerName(data.service_manager_name ?? "");
      setCreatedDate(data.created_date ?? todayISO());
      setAttainmentGoal(data.attainment_goal ?? "");
      setOverallPolicy(data.overall_support_policy ?? "");
      setLongTermGoal(data.long_term_goal ?? "");
      setShortTermGoal(data.short_term_goals ?? "");
      const loaded = Array.isArray(data.goals_json) ? data.goals_json : [];
      const merged: Goal[] = [0, 1, 2].map((i) => loaded[i] ?? {
        priority: i + 1,
        specific_goal: "",
        user_role: "",
        support_content: "",
        support_duration: i === 2 ? "6か月間\n通所日" : "6か月間\n開所日",
      });
      setGoals(merged);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planIdParam]);

  // 計画書の3目標を入力したらモニタリングフォームに自動コピー（編集可）
  useEffect(() => {
    setEvals((prev) =>
      prev.map((e, i) => ({
        ...e,
        user_hope: goals[i]?.specific_goal ?? e.user_hope,
        user_role: goals[i]?.user_role ?? e.user_role,
        support_content: goals[i]?.support_content ?? e.support_content,
      })),
    );
  }, [goals]);
  // 計画書の希望・長期・短期もモニタリングへコピー
  useEffect(() => { setMonUserHope(attainmentGoal); }, [attainmentGoal]);
  useEffect(() => { setMonLongTerm(longTermGoal); }, [longTermGoal]);
  useEffect(() => { setMonShortTerm(shortTermGoal); }, [shortTermGoal]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  };

  const downloadBlob = (blob: Blob, fallbackName: string, contentDisposition: string | null) => {
    const filenameMatch = (contentDisposition ?? "").match(/filename\*=UTF-8''(.+)/);
    const filename = filenameMatch ? decodeURIComponent(filenameMatch[1]) : fallbackName;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSavePlan = async () => {
    if (!selectedClient) {
      showToast("利用者を選択してください");
      return;
    }
    setSaving(true);
    try {
      const res = await saveSupportPlan({
        id: planId ?? undefined,
        clientName: selectedClient,
        planStartDate: planStart,
        planEndDate: planEnd,
        authorName,
        serviceManagerName,
        createdDate,
        attainmentGoal,
        overallSupportPolicy: overallPolicy,
        longTermGoal,
        shortTermGoals: shortTermGoal,
        goals: goals.filter((g) => g.specific_goal.trim() !== ""),
      });
      if (res.error) throw new Error(res.error);
      if (res.id) setPlanId(res.id);
      showToast(planId ? "計画書を更新しました" : "計画書を保存しました");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    if (docType !== "diary" && !selectedClient) {
      showToast("利用者を選択してください");
      return;
    }
    setGenerating(true);
    try {
      let res: Response;
      let fallback = "document.xlsx";

      if (docType === "diary") {
        res = await fetch(`/api/export/diary?date=${diaryDate}`);
        fallback = `業務日報_${diaryDate}.xlsx`;
      } else if (docType === "support_plan") {
        res = await fetch("/api/export/support-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientName: selectedClient,
            authorName, serviceManagerName, createdDate,
            planStartDate: planStart,
            planEndDate: planEnd,
            attainmentGoal,
            overallSupportPolicy: overallPolicy,
            longTermGoal,
            shortTermGoal,
            goals: goals.filter((g) => g.specific_goal.trim() !== ""),
          }),
        });
        fallback = `個別支援計画_${selectedClient}.xlsx`;
      } else {
        res = await fetch("/api/export/monitoring", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientName: selectedClient,
            userHope: monUserHope,
            longTermGoal: monLongTerm,
            shortTermGoal: monShortTerm,
            supportPlan: {
              authorName, serviceManagerName, createdDate,
              planStartDate: planStart, planEndDate: planEnd,
              attainmentGoal, overallSupportPolicy: overallPolicy,
              goals,
            },
            goalEvaluations: evals.map((e, i) => ({ index: i + 1, ...e })),
          }),
        });
        fallback = `モニタリング_${selectedClient}.xlsx`;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "生成失敗");
      }
      const blob = await res.blob();
      downloadBlob(blob, fallback, res.headers.get("content-disposition"));
      showToast("Excelをダウンロードしました");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-slate-900 text-white text-sm font-semibold px-4 py-3 rounded-xl shadow-lg">
          <CheckCircle2 size={16} className="text-white" />
          {toast}
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-2">
          <FileText size={20} className="text-blue-900" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">帳票自動生成</h1>
            <p className="text-sm text-slate-600 mt-0.5">
              事業所提供のExcelテンプレートをそのまま使い、入力内容を該当セルに差し込んで出力します。
            </p>
          </div>
        </div>

        {/* 帳票タイプ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {DOC_TYPES.map((d) => {
            const active = docType === d.id;
            const Icon = d.icon;
            return (
              <button
                key={d.id}
                onClick={() => setDocType(d.id)}
                className={`text-left p-4 rounded-2xl border transition-all ${
                  active
                    ? "bg-white border-blue-900 ring-2 ring-blue-200 text-slate-900"
                    : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                }`}
              >
                <Icon size={18} className={active ? "text-blue-900" : "text-slate-500"} />
                <p className="mt-2 font-bold text-sm">{d.label}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{d.sub}</p>
              </button>
            );
          })}
        </div>

        {/* 利用者選択（業務日報は不要） */}
        {docType !== "diary" && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
              <User size={15} className="text-blue-900" />
              <h2 className="text-sm font-bold text-slate-800">利用者</h2>
            </div>
            <div className="p-5">
              {clients.length === 0 ? (
                <div className="text-sm text-slate-500">
                  <p>利用者が登録されていません</p>
                  <Link
                    href="/settings"
                    className="mt-2 inline-flex items-center gap-1 text-blue-900 font-semibold text-xs hover:underline"
                  >
                    <UserPlus size={12} />
                    利用者を追加
                  </Link>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {clients.map((name) => (
                    <button
                      key={name}
                      onClick={() => setSelectedClient(name)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        selectedClient === name
                          ? "bg-white text-blue-900 border-blue-900 border-2"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* タイプ別フォーム */}
        {docType === "diary" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-800">業務日報の対象日</h2>
            <Label>記録日</Label>
            <Input type="date" value={diaryDate} max={todayISO()} onChange={(e) => setDiaryDate(e.target.value)} />
            <p className="text-[11px] text-slate-500">
              指定日の出欠・日報・シフトをまとめて1ページのExcelに出力します（業務日誌テンプレート準拠）。
            </p>
          </div>
        )}

        {(docType === "support_plan" || docType === "monitoring") && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-800">基本情報（個別支援計画ヘッダ）</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>作成者名</Label>
                <Input value={authorName} onChange={(e) => setAuthorName(e.target.value)} placeholder="山崎 真一" />
              </div>
              <div>
                <Label>サービス管理責任者</Label>
                <Input value={serviceManagerName} onChange={(e) => setServiceManagerName(e.target.value)} placeholder="室崎 真悟" />
              </div>
              <div>
                <Label>作成日</Label>
                <Input type="date" value={createdDate} onChange={(e) => setCreatedDate(e.target.value)} />
              </div>
              <div>
                <Label>計画期間（開始）</Label>
                <Input type="date" value={planStart} onChange={(e) => setPlanStart(e.target.value)} />
              </div>
              <div>
                <Label>計画期間（終了）</Label>
                <Input type="date" value={planEnd} onChange={(e) => setPlanEnd(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label>到達目標（本人の希望）</Label>
                <Textarea rows={2} value={attainmentGoal} onChange={(e) => setAttainmentGoal(e.target.value)} />
              </div>
              <div>
                <Label>総合的な支援の方針</Label>
                <Textarea rows={2} value={overallPolicy} onChange={(e) => setOverallPolicy(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>長期目標</Label>
                  <Input value={longTermGoal} onChange={(e) => setLongTermGoal(e.target.value)} placeholder="一人暮らしをする。" />
                </div>
                <div>
                  <Label>短期目標</Label>
                  <Input value={shortTermGoal} onChange={(e) => setShortTermGoal(e.target.value)} placeholder="朝決めた時間に起きる事が出来る。" />
                </div>
              </div>
            </div>

            <h3 className="text-sm font-bold text-slate-800 pt-2">具体的な到達目標及び支援計画（最大3項目）</h3>
            <div className="space-y-3">
              {goals.map((g, i) => (
                <div key={i} className="border border-slate-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-blue-900">優先順位 {g.priority}</span>
                  </div>
                  <div>
                    <Label>具体的到達目標</Label>
                    <Textarea
                      rows={2}
                      value={g.specific_goal}
                      onChange={(e) => setGoals((p) => p.map((x, j) => j === i ? { ...x, specific_goal: e.target.value } : x))}
                    />
                  </div>
                  <div>
                    <Label>本人の役割</Label>
                    <Textarea
                      rows={2}
                      value={g.user_role}
                      onChange={(e) => setGoals((p) => p.map((x, j) => j === i ? { ...x, user_role: e.target.value } : x))}
                    />
                  </div>
                  <div>
                    <Label>支援内容（内容・留意点等）</Label>
                    <Textarea
                      rows={2}
                      value={g.support_content}
                      onChange={(e) => setGoals((p) => p.map((x, j) => j === i ? { ...x, support_content: e.target.value } : x))}
                    />
                  </div>
                  <div>
                    <Label>支援期間（頻度・時間・期間等）</Label>
                    <Input
                      value={g.support_duration}
                      onChange={(e) => setGoals((p) => p.map((x, j) => j === i ? { ...x, support_duration: e.target.value } : x))}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {docType === "monitoring" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-800">モニタリング評価（3段階）</h2>
            <p className="text-[11px] text-slate-500">A: 達成 ／ B: やや達成 ／ C: 未達成。各目標について「今後の課題」と評価を入力します。</p>
            {evals.map((e, i) => (
              <div key={i} className="border border-slate-200 rounded-xl p-3 space-y-2">
                <p className="text-xs font-bold text-blue-900">目標 {i + 1}</p>
                <div className="text-xs text-slate-600 bg-slate-50 rounded-lg px-2 py-1.5">
                  本人の希望: {e.user_hope || "（計画書から自動取り込み）"}
                </div>
                <div>
                  <Label>今後の課題</Label>
                  <Textarea
                    rows={2}
                    value={e.remaining_issue}
                    onChange={(ev) => setEvals((p) => p.map((x, j) => j === i ? { ...x, remaining_issue: ev.target.value } : x))}
                  />
                </div>
                <div>
                  <Label>評価（A/B/C）</Label>
                  <div className="flex gap-2">
                    {(["A", "B", "C"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setEvals((p) => p.map((x, j) => j === i ? { ...x, evaluation: v } : x))}
                        className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                          e.evaluation === v
                            ? "bg-white text-blue-900 border-blue-900 border-2"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          {docType === "support_plan" && (
            <button
              onClick={handleSavePlan}
              disabled={saving || !selectedClient}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm transition-all ${
                saving || !selectedClient
                  ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                  : "bg-white text-blue-900 border-2 border-blue-900 hover:bg-slate-50"
              }`}
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Save size={16} />
                  {planId ? "計画書を更新" : "計画書をDBに保存"}
                </>
              )}
            </button>
          )}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm transition-all ${
              generating
                ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                : "bg-blue-900 text-white shadow-sm hover:bg-blue-950"
            }`}
          >
            {generating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Download size={16} />
                Excelをダウンロード
              </>
            )}
          </button>
        </div>

        {docType === "support_plan" && planId && (
          <p className="text-[11px] text-slate-500 text-center">
            編集モード（planId: {planId.slice(0, 8)}...）。更新ボタンで上書き保存されます。
          </p>
        )}
      </div>
    </div>
  );
}
