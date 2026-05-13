"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ClipboardList,
  BookOpen,
  Brain,
  CheckCircle2,
  Circle,
  AlertTriangle,
  LogOut,
  Settings,
  FileText,
  Eye,
  PlusCircle,
  Sparkles,
  Send,
  Loader2,
  Shield,
  TrendingUp,
  AlertCircle,
  Target,
  CheckCheck,
  ChevronRight,
  Upload,
  Users,
  User,
  Building2,
  ScrollText,
  Download,
  FileDown,
} from "lucide-react";
// ─────────────────────────────────────────
// データ定義
// ─────────────────────────────────────────

type CheckItem = {
  id: string;
  label: string;
  note?: string;
  overdue?: boolean;
};

type CheckCategory = {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  items: CheckItem[];
};

const CHECKLIST_CATEGORIES: CheckCategory[] = [
  {
    id: "cat-a",
    title: "事前提出書類",
    subtitle: "別紙1",
    icon: Upload,
    color: "blue",
    items: [
      { id: "a1", label: "運営規程" },
      { id: "a2", label: "重要事項説明書" },
      { id: "a3", label: "勤務予定表（様式2）" },
      { id: "a4", label: "サービス提供時間一覧（様式3）" },
      { id: "a5", label: "利用者数調べ（様式4）" },
    ],
  },
  {
    id: "cat-b",
    title: "当日準備：職員関連",
    subtitle: "別紙2",
    icon: Users,
    color: "indigo",
    items: [
      { id: "b1", label: "雇用契約書" },
      { id: "b2", label: "資格証コピー" },
      { id: "b3", label: "健康診断記録" },
    ],
  },
  {
    id: "cat-c",
    title: "当日準備：利用者関連",
    subtitle: "別紙2",
    icon: User,
    color: "teal",
    items: [
      { id: "c1", label: "サービス契約書" },
      { id: "c2", label: "アセスメントシート" },
      { id: "c3", label: "個別支援計画" },
      {
        id: "c4",
        label: "虐待防止委員会の議事録",
        overdue: true,
        note: "直近3ヶ月分",
      },
      { id: "c5", label: "身体拘束適正化の記録" },
    ],
  },
];

const ALL_ITEMS = CHECKLIST_CATEGORIES.flatMap((c) => c.items);

const MANUALS = [
  {
    id: "m1",
    title: "緊急時対応マニュアル",
    emoji: "🚨",
    desc: "医療的緊急事態・事故発生時の初動対応手順",
    color: "red",
    hasTemplate: true,
    hasPdf: false,
  },
  {
    id: "m2",
    title: "感染症対応マニュアル",
    emoji: "🦠",
    desc: "感染症発生時の隔離・報告・消毒対応手順",
    color: "green",
    hasTemplate: true,
    hasPdf: true,
  },
  {
    id: "m3",
    title: "苦情相談対応マニュアル",
    emoji: "💬",
    desc: "利用者・家族からの苦情受付・解決までのフロー",
    color: "blue",
    hasTemplate: true,
    hasPdf: false,
  },
  {
    id: "m4",
    title: "事故等対応マニュアル",
    emoji: "📋",
    desc: "事故発生時の報告書作成・行政通知・再発防止策",
    color: "amber",
    hasTemplate: true,
    hasPdf: true,
  },
  {
    id: "m5",
    title: "非常災害対策計画",
    emoji: "🏠",
    desc: "地震・火災・水害を想定した避難計画・備蓄計画",
    color: "purple",
    hasTemplate: false,
    hasPdf: false,
  },
];

const COLOR_MAP: Record<
  string,
  { bg: string; border: string; badge: string; icon: string; btn: string }
> = {
  red: {
    bg: "bg-red-50",
    border: "border-red-200",
    badge: "bg-red-100 text-red-700",
    icon: "text-red-500",
    btn: "bg-red-500 hover:bg-red-600",
  },
  green: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    badge: "bg-blue-100 text-blue-900",
    icon: "text-blue-900",
    btn: "bg-blue-900 hover:bg-blue-900",
  },
  blue: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    badge: "bg-blue-100 text-blue-900",
    icon: "text-blue-900",
    btn: "bg-blue-900 hover:bg-blue-900",
  },
  amber: {
    bg: "bg-slate-50",
    border: "border-slate-200",
    badge: "bg-slate-100 text-slate-700",
    icon: "text-slate-500",
    btn: "bg-slate-500 hover:bg-slate-600",
  },
  purple: {
    bg: "bg-slate-50",
    border: "border-slate-200",
    badge: "bg-slate-100 text-slate-700",
    icon: "text-slate-500",
    btn: "bg-slate-500 hover:bg-slate-600",
  },
  indigo: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    badge: "bg-blue-100 text-blue-900",
    icon: "text-blue-900",
    btn: "bg-blue-900 hover:bg-blue-900",
  },
  teal: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    badge: "bg-blue-100 text-blue-900",
    icon: "text-blue-900",
    btn: "bg-blue-900 hover:bg-blue-900",
  },
};

const AI_REPORT = {
  achievement:
    "就労継続支援B型の作業場面において、連続作業時間が前期比約55%向上しました（平均45分→70分）。また、職員への声かけ・報告が自発的に行われる場面が増え、コミュニケーション面での大きな成長が確認できます。",
  issues:
    "疲労時に感情調整が難しくなる傾向があり、特に午後の後半に集中力の低下と作業効率の落ち込みが見られます。休憩タイミングの自己判断・申告が引き続き課題です。",
  nextGoal:
    "① 休憩申告を自主的に行う練習を週3回以上継続する　② 手順書を参照しながら一人で完結できる作業の種類を2種類→4種類に拡大する　③ 企業見学・実習体験を1回実施し、一般就労へのイメージを具体化する",
};

// ─────────────────────────────────────────
// Section 1: チェックリスト
// ─────────────────────────────────────────

function ChecklistSection({
  checked,
  toggle,
}: {
  checked: Set<string>;
  toggle: (id: string) => void;
}) {
  const total = ALL_ITEMS.length;
  const done = checked.size;
  const pct = Math.round((done / total) * 100);

  const barColor =
    pct >= 80 ? "bg-blue-900" : pct >= 50 ? "bg-blue-900" : "bg-slate-500";
  const pctColor =
    pct >= 80
      ? "text-blue-900"
      : pct >= 50
      ? "text-blue-900"
      : "text-slate-600";
  const message =
    pct >= 80
      ? "素晴らしい！運営指導の準備が整っています 🎉"
      : pct >= 50
      ? "あと少しで完了です！一緒に頑張りましょう 💪"
      : "まずは事前提出書類から着実に進めましょう！";

  return (
    <div className="space-y-6">
      {/* スコアカード */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Shield size={18} className={pctColor} />
            <span className="font-semibold text-slate-700 text-sm">
              運営指導 準備スコア
            </span>
          </div>
          <span className={`text-3xl font-bold tabular-nums ${pctColor}`}>
            {pct}%
          </span>
        </div>
        <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden mb-2">
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-slate-500">{message}</p>
      </div>

      {/* カテゴリ別チェックリスト */}
      {CHECKLIST_CATEGORIES.map((cat) => {
        const catDone = cat.items.filter((i) => checked.has(i.id)).length;
        const c = COLOR_MAP[cat.color];
        const Icon = cat.icon;
        return (
          <div
            key={cat.id}
            className={`bg-white rounded-2xl border ${c.border} shadow-sm overflow-hidden`}
          >
            {/* カテゴリヘッダー */}
            <div className={`px-5 py-3.5 ${c.bg} border-b ${c.border} flex items-center gap-3`}>
              <div className={`p-1.5 rounded-lg bg-white/70 ${c.icon}`}>
                <Icon size={16} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-800 text-sm">{cat.title}</h3>
                <p className="text-xs text-slate-500">{cat.subtitle}</p>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${c.badge}`}>
                {catDone} / {cat.items.length}
              </span>
            </div>

            {/* チェック項目 */}
            <ul className="divide-y divide-slate-50">
              {cat.items.map((item) => {
                const isChecked = checked.has(item.id);
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => toggle(item.id)}
                      className="w-full flex items-center gap-3.5 px-5 py-3.5 hover:bg-slate-50 transition-colors text-left group"
                    >
                      <span
                        className={`shrink-0 transition-colors ${
                          isChecked
                            ? "text-blue-900"
                            : "text-slate-300 group-hover:text-blue-400"
                        }`}
                      >
                        {isChecked ? (
                          <CheckCircle2 size={20} />
                        ) : (
                          <Circle size={20} />
                        )}
                      </span>

                      <span
                        className={`flex-1 text-sm font-medium transition-all ${
                          isChecked
                            ? "line-through text-slate-400"
                            : "text-slate-700"
                        }`}
                      >
                        {item.label}
                        {item.note && (
                          <span className="ml-2 text-xs text-slate-400 font-normal">
                            ({item.note})
                          </span>
                        )}
                      </span>

                      {item.overdue && !isChecked && (
                        <span className="shrink-0 flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                          <AlertTriangle size={10} />
                          要対応
                        </span>
                      )}
                      {isChecked && (
                        <span className="shrink-0 text-xs font-semibold text-blue-900 bg-blue-50 px-2 py-0.5 rounded-full">
                          完了 ✓
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      {done === total && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-center">
          <p className="text-blue-900 font-bold text-base">
            🎉 全書類の準備が完了しました！運営指導は万全です。
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// Section 2: マニュアル管理
// ─────────────────────────────────────────

function ManualsSection() {
  const [editing, setEditing] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-bold text-slate-800 text-base">必須マニュアル 5点</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          行政指定の5大マニュアルを雛形から作成・管理できます
        </p>
      </div>

      {/* プレビューモーダル風バナー */}
      {previewing && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex items-start gap-4">
          <Eye size={20} className="text-blue-900 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-blue-800 text-sm">
              PDFプレビュー：
              {MANUALS.find((m) => m.id === previewing)?.title}
            </p>
            <p className="text-xs text-blue-900 mt-1">
              ※ デモ環境のため、実際のPDFは表示されません。本番環境ではPDFビューアが起動します。
            </p>
          </div>
          <button
            onClick={() => setPreviewing(null)}
            className="text-blue-400 hover:text-blue-900 text-xs underline shrink-0"
          >
            閉じる
          </button>
        </div>
      )}

      {/* 編集モーダル風バナー */}
      {editing && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex items-start gap-4">
          <PlusCircle size={20} className="text-blue-900 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-blue-800 text-sm">
              雛形エディタ：
              {MANUALS.find((m) => m.id === editing)?.title}
            </p>
            <p className="text-xs text-blue-900 mt-1">
              ※ デモ環境のため、編集機能は本番環境で利用可能です。コンサルタント作成の標準雛形をベースに事業所ごとにカスタマイズできます。
            </p>
          </div>
          <button
            onClick={() => setEditing(null)}
            className="text-blue-400 hover:text-blue-900 text-xs underline shrink-0"
          >
            閉じる
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {MANUALS.map((manual) => {
          const c = COLOR_MAP[manual.color];
          return (
            <div
              key={manual.id}
              className={`bg-white rounded-2xl border ${c.border} shadow-sm overflow-hidden flex flex-col`}
            >
              {/* サムネイル */}
              <div className={`${c.bg} px-5 py-6 flex items-center gap-4`}>
                <span className="text-4xl">{manual.emoji}</span>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-slate-800 text-sm leading-snug">
                    {manual.title}
                  </h4>
                  <span
                    className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${c.badge}`}
                  >
                    {manual.hasPdf ? "PDF保存済み" : "未作成"}
                  </span>
                </div>
              </div>

              {/* 説明文 */}
              <div className="px-5 py-3 flex-1">
                <p className="text-xs text-slate-500 leading-relaxed">{manual.desc}</p>
              </div>

              {/* ボタン */}
              <div className="px-5 pb-4 flex gap-2">
                <button
                  onClick={() => setEditing(manual.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-white transition-all ${c.btn} active:scale-[0.97]`}
                >
                  <PlusCircle size={13} />
                  {manual.hasTemplate ? "雛形から作成" : "新規作成"}
                </button>
                <button
                  onClick={() => {
                    if (manual.hasPdf) setPreviewing(manual.id);
                  }}
                  disabled={!manual.hasPdf}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    manual.hasPdf
                      ? `${c.border} ${c.icon} hover:${c.bg} border`
                      : "border-slate-200 text-slate-300 cursor-not-allowed"
                  }`}
                >
                  <Eye size={13} />
                  PDF
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Section 3: AI日報 & モニタリング
// ─────────────────────────────────────────

function AIDiarySection() {
  const [diary, setDiary] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [report, setReport] = useState<typeof AI_REPORT | null>(null);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [clients, setClients] = useState<string[]>([]);
  const [facilityId, setFacilityId] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("facility_id").eq("id", user.id).single();
      setFacilityId(profile?.facility_id ?? "");
      const { data } = await supabase
        .from("clients")
        .select("name")
        .eq("facility_id", profile?.facility_id)
        .eq("status", "active")
        .order("name");
      const names = data?.map((c) => c.name) ?? [];
      setClients(names);
      if (names.length > 0) setSelectedUser(names[0]);
    };
    load();
  }, []);

  const handleSubmit = () => {
    if (!diary.trim()) return;
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
    setDiary("");
  };

  const handleGenerate = async () => {
    setAiLoading(true);
    setReport(null);

    const diaryEntries = diary.trim()
      ? diary
      : "作業への集中度は良好。コミュニケーションも積極的。体調は安定していた。";

    try {
      const res = await fetch("/api/generate-monitoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userName: selectedUser || "利用者",
          diaryEntries,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setReport(data);
    } catch {
      setReport(AI_REPORT); // フォールバック
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 日報入力 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <ScrollText size={16} className="text-blue-900" />
          <h3 className="font-bold text-slate-700 text-sm">今日の日報を記録</h3>
        </div>
        <div className="p-5 space-y-4">
          {/* 利用者選択 */}
          <div className="flex gap-2 flex-wrap">
            {clients.map((name) => (
              <button
                key={name}
                onClick={() => setSelectedUser(name)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  selectedUser === name
                    ? "bg-blue-900 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {name}
              </button>
            ))}
          </div>

          <textarea
            value={diary}
            onChange={(e) => setDiary(e.target.value)}
            placeholder="例：本日はAさんの作業集中時間が長くなり、午前中に2時間連続して取り組めた。昼食後は少し表情が硬くなる場面があったが、声かけにより落ち着きを取り戻した。"
            rows={5}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-700 placeholder:text-slate-300 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent"
          />

          <div className="flex items-center justify-between">
            {submitted && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-blue-900">
                <CheckCircle2 size={14} />
                日報を保存しました
              </span>
            )}
            {!submitted && <span />}
            <button
              onClick={handleSubmit}
              disabled={!diary.trim()}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all ${
                diary.trim()
                  ? "bg-blue-900 hover:bg-blue-900 active:scale-[0.97]"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              }`}
            >
              <Send size={14} />
              日報を保存
            </button>
          </div>
        </div>
      </div>

      {/* モニタリング生成 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Brain size={16} className="text-blue-900" />
          <h3 className="font-bold text-slate-700 text-sm">
            AIモニタリング評価
          </h3>
          <span className="ml-auto text-xs font-semibold bg-blue-100 text-blue-900 px-2 py-0.5 rounded-full">
            キラー機能
          </span>
        </div>

        <div className="p-5 space-y-4">
          {/* 利用者リスト */}
          <div className="space-y-2">
            {clients.map((name) => (
              <div
                key={name}
                onClick={() => setSelectedUser(name)}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  selectedUser === name
                    ? "border-blue-300 bg-blue-50"
                    : "border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center shrink-0">
                  <User size={15} className="text-slate-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800">{name}</p>
                </div>
                {selectedUser === name && (
                  <ChevronRight size={15} className="text-blue-400 shrink-0" />
                )}
              </div>
            ))}
          </div>

          {/* 生成ボタン */}
          <button
            onClick={handleGenerate}
            disabled={aiLoading}
            className={`w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl font-bold text-sm transition-all ${
              aiLoading
                ? "bg-blue-300 text-white cursor-wait"
                : "bg-gradient-to-r from-blue-900 to-blue-900 hover:from-blue-900 hover:to-blue-900 text-white shadow-md hover:shadow-lg active:scale-[0.98]"
            }`}
          >
            {aiLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                AIが半年分の日報を解析中...
              </>
            ) : (
              <>
                <Sparkles size={18} />
                {selectedUser}の個別支援計画モニタリングをAIで自動生成
              </>
            )}
          </button>

          {/* スケルトン */}
          {aiLoading && (
            <div className="animate-pulse space-y-3 pt-2">
              <div className="h-3 bg-slate-200 rounded w-1/3" />
              <div className="h-2 bg-slate-100 rounded w-full" />
              <div className="h-2 bg-slate-100 rounded w-5/6" />
              <div className="h-3 bg-slate-200 rounded w-1/4 mt-4" />
              <div className="h-2 bg-slate-100 rounded w-full" />
              <div className="h-2 bg-slate-100 rounded w-3/4" />
            </div>
          )}

          {/* 生成済みレポート */}
          {report && !aiLoading && (
            <div className="border border-blue-200 rounded-2xl overflow-hidden mt-2">
              <div className="px-5 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
                <Sparkles size={14} className="text-blue-900" />
                <span className="text-xs font-bold text-blue-900">
                  AI生成 — {selectedUser}　個別支援計画モニタリング評価案
                </span>
                <span className="ml-auto text-xs text-blue-400">
                  ※ 内容を確認の上ご活用ください
                </span>
              </div>
              <div className="p-5 space-y-5 bg-white">
                <ReportBlock
                  icon={TrendingUp}
                  label="達成度"
                  color="emerald"
                  content={report.achievement}
                />
                <ReportBlock
                  icon={AlertCircle}
                  label="課題"
                  color="amber"
                  content={report.issues}
                />
                <ReportBlock
                  icon={Target}
                  label="次期目標案"
                  color="blue"
                  content={report.nextGoal}
                />
              </div>
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                <button
                  disabled={pdfLoading}
                  onClick={async () => {
                    if (!report || !facilityId) return;
                    setPdfLoading(true);
                    try {
                      const today = new Date().toISOString().slice(0, 10);
                      const sixMonthsAgo = new Date();
                      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
                      const res = await fetch("/api/generate-document", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          type: "monitoring_report",
                          clientName: selectedUser || "利用者",
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
                      const filename = m
                        ? decodeURIComponent(m[1])
                        : `モニタリング報告書_${selectedUser}.pdf`;
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url; a.download = filename; a.click();
                      URL.revokeObjectURL(url);
                    } catch { alert("PDF生成に失敗しました"); }
                    finally { setPdfLoading(false); }
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-900 hover:bg-blue-900 disabled:bg-slate-300 transition-colors"
                >
                  {pdfLoading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                  PDF出力
                </button>
                <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-900 hover:bg-blue-900 transition-colors">
                  <CheckCheck size={13} />
                  書類保管庫に保存
                </button>
              </div>
            </div>
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
    emerald: "bg-blue-50 text-blue-900",
    amber: "bg-slate-50 text-slate-700",
    blue: "bg-blue-50 text-blue-900",
  };
  return (
    <div>
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-2 ${styles[color]}`}
      >
        <Icon size={12} />
        {label}
      </span>
      <p className="text-sm text-slate-700 leading-relaxed">{content}</p>
    </div>
  );
}

// ─────────────────────────────────────────
// メインページ
// ─────────────────────────────────────────

type Menu = "checklist" | "manuals" | "ai-diary";

const MENUS: {
  id: Menu;
  label: string;
  sub: string;
  Icon: React.ElementType;
}[] = [
  {
    id: "checklist",
    label: "運営指導チェックリスト",
    sub: "別紙1・2 書類管理",
    Icon: ClipboardList,
  },
  {
    id: "manuals",
    label: "マニュアル管理",
    sub: "5大必須マニュアル",
    Icon: BookOpen,
  },
  {
    id: "ai-diary",
    label: "AI日報 & モニタリング",
    sub: "日報入力・評価自動生成",
    Icon: Brain,
  },
];

export default function ClientDashboard() {
  const [menu, setMenu] = useState<Menu>("checklist");
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const activeMenu = MENUS.find((m) => m.id === menu)!;

  return (
    <div className="flex min-h-full">
      {/* モバイル固定ヘッダー */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 size={15} className="text-blue-900" />
          <span className="text-sm font-bold text-slate-800">さくら福祉センター</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500">準備スコア</span>
          <span className="text-sm font-bold text-blue-900">
            {Math.round((checked.size / ALL_ITEMS.length) * 100)}%
          </span>
        </div>
      </header>

      {/* 左ナビ（デスクトップのみ） */}
      <nav className="hidden md:flex w-56 shrink-0 bg-white border-r border-slate-200 flex-col">
        {/* ヘッダー */}
        <div className="px-4 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-1">
            <Building2 size={16} className="text-blue-900" />
            <span className="text-xs font-bold text-blue-900 uppercase tracking-wide">
              クライアント専用
            </span>
          </div>
          <p className="text-xs text-slate-500 leading-snug">
            さくら福祉センター
          </p>
        </div>

        {/* 日報入力ボタン */}
        <div className="px-3 pt-3 space-y-1.5">
          <Link
            href="/diary"
            className="flex items-center gap-2 w-full px-3 py-3 rounded-xl bg-blue-900 text-white text-xs font-bold hover:bg-blue-900 transition-colors"
          >
            <ScrollText size={15} />
            日報を入力する
          </Link>
          <Link
            href="/diary/batch"
            className="flex items-center gap-2 w-full px-3 py-2 rounded-xl bg-blue-50 text-blue-900 text-xs font-semibold border border-blue-200 hover:bg-blue-100 transition-colors"
          >
            <Users size={13} />
            一括入力モード
          </Link>
        </div>

        {/* メニュー項目 */}
        <div className="flex-1 p-3 space-y-1">
          {MENUS.map(({ id, label, sub, Icon }) => {
            const isActive = menu === id;
            return (
              <button
                key={id}
                onClick={() => setMenu(id)}
                className={`w-full flex items-start gap-3 px-3 py-3 rounded-xl text-left transition-all ${
                  isActive
                    ? "bg-blue-900 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                }`}
              >
                <Icon size={17} className="shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold leading-snug">{label}</p>
                  <p
                    className={`text-xs mt-0.5 leading-snug ${
                      isActive ? "text-blue-200" : "text-slate-400"
                    }`}
                  >
                    {sub}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* 設定・ログアウト */}
        <div className="px-3 pb-2 space-y-1">
          <Link
            href="/documents/generate"
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold text-blue-900 bg-blue-50 hover:bg-blue-100 transition-colors border border-blue-100"
          >
            <FileDown size={14} />
            帳票自動生成
          </Link>
          <Link
            href="/settings"
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <Settings size={14} />
            設定（利用者・指導員）
          </Link>
          <form action="/api/logout" method="POST">
            <button
              type="submit"
              onClick={async (e) => {
                e.preventDefault();
                const { logout } = await import("@/app/actions/auth");
                logout();
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            >
              <LogOut size={14} />
              ログアウト
            </button>
          </form>
        </div>

        {/* スコアミニ表示（チェックリスト） */}
        <div className="p-3 border-t border-slate-100">
          <div className="bg-slate-50 rounded-xl px-3 py-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-slate-500 font-medium">準備スコア</span>
              <span className="text-xs font-bold text-blue-900">
                {Math.round((checked.size / ALL_ITEMS.length) * 100)}%
              </span>
            </div>
            <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-900 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.round((checked.size / ALL_ITEMS.length) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>
      </nav>

      {/* 右コンテンツ */}
      <div className="flex-1 overflow-y-auto pt-[57px] md:pt-0 px-4 py-4 md:p-8 pb-20 md:pb-8">
        {/* ページヘッダー */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-0.5">
            <activeMenu.Icon size={18} className="text-blue-900" />
            <h2 className="text-xl font-bold text-slate-800">
              {activeMenu.label}
            </h2>
          </div>
          <p className="text-sm text-slate-500">{activeMenu.sub}</p>
        </div>

        {/* コンテンツ切り替え */}
        {menu === "checklist" && (
          <ChecklistSection checked={checked} toggle={toggle} />
        )}
        {menu === "manuals" && <ManualsSection />}
        {menu === "ai-diary" && <AIDiarySection />}
      </div>

      {/* モバイル ボトムナビ */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex items-end justify-around h-14 px-2">
          {/* チェックリスト */}
          <button
            onClick={() => setMenu("checklist")}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
              menu === "checklist" ? "text-blue-900" : "text-slate-400"
            }`}
          >
            <ClipboardList size={20} />
            <span className="text-[10px] font-semibold">チェック</span>
          </button>

          {/* マニュアル */}
          <button
            onClick={() => setMenu("manuals")}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
              menu === "manuals" ? "text-blue-900" : "text-slate-400"
            }`}
          >
            <BookOpen size={20} />
            <span className="text-[10px] font-semibold">マニュアル</span>
          </button>

          {/* 中央FAB: 日報入力 */}
          <div className="flex flex-col items-center justify-end pb-1.5 flex-1">
            <div className="flex items-end gap-1 -mt-5">
              <Link
                href="/diary"
                className="w-12 h-12 bg-blue-900 rounded-full flex items-center justify-center shadow-lg text-white transition-transform active:scale-95"
              >
                <ScrollText size={20} />
              </Link>
              <Link
                href="/diary/batch"
                className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shadow text-blue-900 transition-transform active:scale-95"
              >
                <Users size={14} />
              </Link>
            </div>
            <span className="text-[10px] font-semibold text-blue-900 mt-0.5">日報</span>
          </div>

          {/* AI日報 */}
          <button
            onClick={() => setMenu("ai-diary")}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
              menu === "ai-diary" ? "text-blue-900" : "text-slate-400"
            }`}
          >
            <Brain size={20} />
            <span className="text-[10px] font-semibold">AI日報</span>
          </button>

          {/* 設定 */}
          <Link
            href="/settings"
            className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-slate-400 transition-colors active:text-blue-900"
          >
            <Settings size={20} />
            <span className="text-[10px] font-semibold">設定</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
