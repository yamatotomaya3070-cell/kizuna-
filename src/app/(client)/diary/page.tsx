"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Send,
  ChevronRight,
  ChevronLeft,
  User,
  Users,
  ClipboardList,
  Loader2,
  CalendarDays,
  Wand2,
} from "lucide-react";
import { saveDiary } from "@/app/actions/diary";
import { getAttendanceForClient, type AttendanceRecord } from "@/app/actions/attendance";
import { getShiftStaff, type ShiftStaff } from "@/app/actions/shifts";
import { createClient } from "@/lib/supabase/client";
import { B_TYPE_FORMAT, getServiceFormat, type ServiceFormat } from "@/data/service-formats";

const LUNCH = [
  { value: "○", label: "○ 加算対象", color: "emerald" },
  { value: "●", label: "● なし", color: "slate" },
];

const TRANSPORT = [
  { value: "○", label: "○ 送迎両方", color: "emerald" },
  { value: "△", label: "△ どちらか", color: "amber" },
  { value: "●", label: "● なし", color: "slate" },
];

type Step = "date" | "client" | "basic" | "eval" | "done";

// 業務システム向けに白・黒・紺で統一。色キーは service-formats からの参照互換のため残す
const colorMap: Record<string, { bg: string; border: string; text: string; pill: string }> = {
  emerald: { bg: "bg-white",  border: "border-blue-900",  text: "text-blue-900",  pill: "bg-blue-900" },
  amber:   { bg: "bg-slate-100", border: "border-slate-500", text: "text-slate-700", pill: "bg-slate-500" },
  red:     { bg: "bg-red-50",    border: "border-red-700",   text: "text-red-700",    pill: "bg-red-700" },
  slate:   { bg: "bg-slate-50",  border: "border-slate-300", text: "text-slate-600",  pill: "bg-slate-400" },
  blue:    { bg: "bg-white",   border: "border-blue-900",  text: "text-blue-900",   pill: "bg-blue-900" },
};

const STEPS: { key: Step; label: string }[] = [
  { key: "date", label: "日付" },
  { key: "client", label: "利用者" },
  { key: "basic", label: "基本情報" },
  { key: "eval", label: "評価" },
];

function StepBar({ current }: { current: Step }) {
  const idx = STEPS.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center gap-1">
      {STEPS.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              i < idx
                ? "bg-blue-900 text-white"
                : i === idx
                ? "bg-blue-900 text-white ring-2 ring-blue-200"
                : "bg-slate-100 text-slate-400"
            }`}
          >
            {i < idx ? <CheckCircle2 size={13} /> : i + 1}
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-0.5 w-4 rounded ${i < idx ? "bg-blue-900" : "bg-slate-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateJa(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
}

export default function DiaryPage() {
  const todayStr = toLocalDateStr(new Date());

  const [step, setStep] = useState<Step>("date");
  const [recordedDate, setRecordedDate] = useState<string>(todayStr);
  const [shiftStaff, setShiftStaff] = useState<ShiftStaff[]>([]);
  const [shiftHasData, setShiftHasData] = useState(false);
  const [loadingShift, setLoadingShift] = useState(false);
  const [manualStaffOverride, setManualStaffOverride] = useState("");

  const [clientName, setClientName] = useState("");
  const [attendance, setAttendance] = useState("");
  const [lunch, setLunch] = useState("");
  const [transport, setTransport] = useState("");

  // 評価ステップ
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [memo, setMemo] = useState("");
  const [aiComment, setAiComment] = useState("");
  const [finalComment, setFinalComment] = useState("");
  const [generating, setGenerating] = useState(false);

  const [loading, setLoading] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const [clients, setClients] = useState<string[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [adminAttendance, setAdminAttendance] = useState<AttendanceRecord | null>(null);
  const [loadingAdminAttendance, setLoadingAdminAttendance] = useState(false);
  const [serviceFormat, setServiceFormat] = useState<ServiceFormat>(B_TYPE_FORMAT);
  const [additionalValues, setAdditionalValues] = useState<Record<string, string>>({});

  // 利用者・サービス種別の初期取得
  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoadingClients(false); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("facility_id, facilities(service_type)")
        .eq("id", user.id)
        .single();

      const facilityId = profile?.facility_id;
      const serviceType = (profile?.facilities as { service_type?: string } | null)?.service_type ?? "b_type";
      setServiceFormat(getServiceFormat(serviceType));

      // status カラムは 20260502_client_master.sql で追加。未適用環境でもクラッシュしないよう
      // 1) まず status つきで取得、失敗したら status なしで再取得、2) 'left' のみクライアントで除外
      let rows: { name: string; status?: string | null }[] = [];
      const withStatus = await supabase
        .from("clients")
        .select("name, status")
        .eq("facility_id", facilityId)
        .order("name");

      if (withStatus.error) {
        const fallback = await supabase
          .from("clients")
          .select("name")
          .eq("facility_id", facilityId)
          .order("name");
        if (fallback.error) {
          console.error("clients fetch failed:", fallback.error);
        }
        rows = (fallback.data ?? []) as { name: string }[];
      } else {
        rows = (withStatus.data ?? []) as { name: string; status?: string | null }[];
      }

      setClients(
        rows
          .filter((c) => (c.status ?? "active") !== "left")
          .map((c) => c.name),
      );
      setLoadingClients(false);
    };
    fetchData();
  }, []);

  // 日付が変わったらシフト職員を取得
  useEffect(() => {
    if (!recordedDate) return;
    setLoadingShift(true);
    setManualStaffOverride("");
    getShiftStaff(recordedDate).then((res) => {
      setShiftStaff(res.staff);
      setShiftHasData(res.hasShift);
      setLoadingShift(false);
    });
  }, [recordedDate]);

  // 利用者と日付が決まったら出欠を取得（選択した日付ベース）
  useEffect(() => {
    if (!clientName || !recordedDate) { setAdminAttendance(null); return; }
    setLoadingAdminAttendance(true);
    getAttendanceForClient(clientName, recordedDate).then(({ data }) => {
      setAdminAttendance(data);
      if (data) {
        setAttendance(data.attendance);
        setLunch(data.lunch);
        setTransport(data.transport);
      }
      setLoadingAdminAttendance(false);
    });
  }, [clientName, recordedDate]);

  const isAbsent = attendance === "●";

  const autoStaffNames = shiftStaff.map((s) => s.name).join("、");
  const shiftStaffNames = manualStaffOverride.trim() || autoStaffNames;

  // 評価ステップで使うテンプレ集（役職に依存せず両方を「材料」として提示）
  const allTemplates = (() => {
    const positives = new Set<string>();
    const neutrals = new Set<string>();
    const concerns = new Set<string>();
    serviceFormat.roles.forEach((r) => {
      r.templates.positive.forEach((t) => positives.add(t));
      r.templates.neutral.forEach((t) => neutrals.add(t));
      r.templates.concern.forEach((t) => concerns.add(t));
    });
    return {
      positive: [...positives],
      neutral: [...neutrals],
      concern: [...concerns],
    };
  })();

  const COMMENT_MIN_LENGTH = 30;
  const canNext: Record<Step, boolean> = {
    date:   recordedDate !== "" && shiftStaffNames !== "",
    client: clientName !== "",
    basic:  adminAttendance != null
              ? true
              : attendance !== "" && (isAbsent || (lunch !== "" && transport !== "")),
    eval:   isAbsent || finalComment.trim().length >= COMMENT_MIN_LENGTH,
    done:   true,
  };

  const next = () => {
    const order: Step[] = ["date", "client", "basic", "eval", "done"];
    const idx = order.indexOf(step);
    if (idx < order.length - 1) setStep(order[idx + 1]);
  };

  const back = () => {
    const order: Step[] = ["date", "client", "basic", "eval", "done"];
    const idx = order.indexOf(step);
    if (idx > 0) setStep(order[idx - 1]);
  };

  const toggleItem = (text: string) => {
    setSelectedItems((prev) =>
      prev.includes(text) ? prev.filter((t) => t !== text) : [...prev, text]
    );
  };

  const handleGenerate = async () => {
    if (selectedItems.length === 0 && memo.trim() === "") {
      alert("選択項目またはメモを少なくとも1つ入れてください");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/generate-diary-comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName,
          selectedItems,
          memo,
          recordedDate,
          attendance,
          serviceTypeLabel: serviceFormat.name,
        }),
      });
      const data = await res.json();
      const comment = (data?.comment as string | undefined) ?? "";
      if (comment) {
        setAiComment(comment);
        setFinalComment(comment);
      } else {
        const fallback = [...selectedItems, memo].filter(Boolean).join("。") + "。";
        setAiComment(fallback);
        setFinalComment(fallback);
      }
    } catch {
      const fallback = [...selectedItems, memo].filter(Boolean).join("。") + "。";
      setAiComment(fallback);
      setFinalComment(fallback);
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const staffNameForRecord = shiftStaffNames || "";
      await saveDiary({
        clientName,
        staffName: staffNameForRecord,
        attendance,
        breakfast: lunch,
        sleep: transport,
        recordedDate,
        role: "shift",
        ratings: {
          ...additionalValues,
          selectedItems,
          memo,
          aiGeneratedComment: aiComment,
          finalComment,
          eval: finalComment,
        },
        comments: {
          staffSource: manualStaffOverride.trim() ? "manual" : shiftHasData ? "shift" : "fallback",
          shiftStaffNames,
          shiftStaffIds: shiftStaff.map((s) => s.staffId).filter(Boolean) as string[],
          shiftHasData,
          memo,
        },
      });
      setDoneCount((n) => n + 1);
      setStep("done");
    } catch {
      alert("保存に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const resetEvalFields = () => {
    setSelectedItems([]);
    setMemo("");
    setAiComment("");
    setFinalComment("");
  };

  const resetForNext = () => {
    setClientName("");
    setAttendance("");
    setLunch("");
    setTransport("");
    setAdditionalValues({});
    setAdminAttendance(null);
    resetEvalFields();
    setStep("client");
  };

  const resetAll = () => {
    setRecordedDate(todayStr);
    setClientName("");
    setAttendance("");
    setLunch("");
    setTransport("");
    setAdditionalValues({});
    setAdminAttendance(null);
    resetEvalFields();
    setDoneCount(0);
    setStep("date");
  };

  // ── 完了画面 ──
  if (step === "done") {
    return (
      <div className="min-h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-5">
          <CheckCircle2 size={40} className="text-blue-900" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-1">送信完了</h2>
        <p className="text-sm text-slate-600 mb-1">{clientName}さんの日報を保存しました</p>
        <p className="text-xs text-slate-500 mb-2">
          {formatDateJa(recordedDate)}　担当: {shiftStaffNames || "—"}
        </p>
        <span className="text-xs font-bold bg-white text-blue-900 px-3 py-1 rounded-full mb-8 border border-blue-200">
          本日 {doneCount}名 完了
        </span>
        <div className="w-full max-w-xs space-y-3">
          <button
            onClick={resetForNext}
            className="w-full py-3.5 bg-blue-900 text-white rounded-2xl font-bold text-sm"
          >
            次の利用者を入力
          </button>
          <button
            onClick={resetAll}
            className="w-full py-3.5 bg-white border border-slate-300 text-slate-700 rounded-2xl font-bold text-sm"
          >
            最初に戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 pt-5 pb-32 md:max-w-lg md:mx-auto">
      {/* ヘッダー */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ClipboardList size={16} className="text-blue-900" />
              日報入力
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {recordedDate ? formatDateJa(recordedDate) : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {doneCount > 0 && (
              <span className="text-xs font-bold bg-white text-blue-900 px-2.5 py-1 rounded-full border border-blue-200">
                {doneCount}名完了
              </span>
            )}
            <Link
              href="/diary/batch"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
            >
              <Users size={12} />
              一括入力
            </Link>
          </div>
        </div>
        <StepBar current={step} />
      </div>

      {/* 全ステップで上部にシフト担当者を表示 */}
      {step !== "date" && (
        <div
          className={`mb-4 border rounded-2xl px-4 py-3 ${
            shiftHasData
              ? "bg-slate-50 border-slate-200"
              : "bg-slate-50 border-slate-300"
          }`}
        >
          <p className={`text-[11px] mb-1 ${shiftHasData ? "text-slate-500" : "text-slate-700 font-semibold"}`}>
            {shiftHasData
              ? "担当職員（シフトより自動取得）"
              : "この日のシフトが登録されていません"}
          </p>
          {loadingShift ? (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 size={12} className="animate-spin" />
              読み込み中...
            </div>
          ) : (
            <p className="text-sm font-bold text-slate-900">{shiftStaffNames || "—"}</p>
          )}
        </div>
      )}

      {/* ── Step: 記録日選択 ── */}
      {step === "date" && (
        <div className="space-y-5">
          <div className="mb-2">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <CalendarDays size={18} className="text-blue-900" />
              記録日を選んでください
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">過去日も選べます。初期値は今日です。</p>
          </div>

          <div>
            <label htmlFor="recorded-date" className="text-xs font-bold text-slate-700 mb-2 block">
              記録日
            </label>
            <input
              id="recorded-date"
              type="date"
              value={recordedDate}
              max={todayStr}
              onChange={(e) => setRecordedDate(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-slate-300 bg-white text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
            />
            <p className="text-xs text-slate-500 mt-1.5">{formatDateJa(recordedDate)}</p>
          </div>

          <div>
            <p className="text-xs font-bold text-slate-700 mb-2">この日の担当職員</p>
            {loadingShift ? (
              <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 flex items-center gap-2 text-slate-400 text-sm">
                <Loader2 size={14} className="animate-spin" />
                読み込み中...
              </div>
            ) : shiftHasData ? (
              <div className="bg-white border border-blue-900 rounded-2xl px-4 py-3">
                <p className="text-sm font-bold text-slate-900">{autoStaffNames}</p>
                <p className="text-[11px] text-blue-900 mt-0.5">シフトより自動取得</p>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-300 rounded-2xl px-4 py-3 space-y-2">
                <p className="text-xs font-bold text-slate-800">
                  この日のシフトが登録されていません
                </p>
                <p className="text-[11px] text-slate-600">
                  管理者にシフト登録を依頼するか、担当職員を下に入力してください
                  {autoStaffNames && `（登録職員: ${autoStaffNames}）`}
                </p>
                <input
                  type="text"
                  value={manualStaffOverride}
                  onChange={(e) => setManualStaffOverride(e.target.value)}
                  placeholder="例: 山田 太郎、佐藤 花子"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Step: 利用者選択 ── */}
      {step === "client" && (
        <div>
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900">誰を記録しますか？</h2>
            <p className="text-xs text-slate-500 mt-0.5">利用者を1名選んでください</p>
          </div>
          {loadingClients ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-slate-300" />
            </div>
          ) : clients.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              利用者が登録されていません。<br />管理者に追加を依頼してください。
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {clients.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setClientName(name)}
                  className={`py-3.5 px-3 rounded-2xl border text-sm font-bold transition-all active:scale-[0.97] ${
                    clientName === name
                      ? "bg-white border-blue-900 text-blue-900"
                      : "bg-white border-slate-200 text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Step: 基本情報 ── */}
      {step === "basic" && (
        <div className="space-y-5">
          <div className="mb-2">
            <h2 className="text-lg font-bold text-slate-900">{clientName}さん</h2>
            <p className="text-xs text-slate-500 mt-0.5">{formatDateJa(recordedDate)}の基本情報</p>
          </div>

          {loadingAdminAttendance ? (
            <div className="flex justify-center py-8">
              <Loader2 size={22} className="animate-spin text-slate-300" />
            </div>
          ) : adminAttendance ? (
            <div className="space-y-4">
              <div className="bg-white border border-blue-200 rounded-2xl px-4 py-3 flex items-center gap-2">
                <CheckCircle2 size={15} className="text-blue-900 shrink-0" />
                <p className="text-xs font-semibold text-blue-900">管理者が入力済みです</p>
              </div>
              {[
                { label: "出欠", value: adminAttendance.attendance, opts: serviceFormat.attendanceOptions },
                { label: "昼食", value: adminAttendance.lunch, opts: LUNCH },
                { label: "送迎", value: adminAttendance.transport, opts: TRANSPORT },
              ].map(({ label, value, opts }) => {
                const opt = opts.find((o) => o.value === value);
                const c = colorMap[opt?.color ?? "slate"];
                return (
                  <div key={label}>
                    <p className="text-sm font-bold text-slate-700 mb-2">{label}</p>
                    <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${c.bg} ${c.border}`}>
                      <span className={`text-lg font-bold w-6 text-center ${c.text}`}>{value}</span>
                      <span className={`text-sm font-semibold ${c.text}`}>{opt?.label ?? value}</span>
                      <CheckCircle2 size={16} className={`ml-auto ${c.text}`} />
                    </div>
                  </div>
                );
              })}
              {isAbsent && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
                  <p className="text-sm text-slate-500">欠席のため評価は不要です</p>
                </div>
              )}
            </div>
          ) : (
            <>
              <div>
                <p className="text-sm font-bold text-slate-700 mb-2">出欠</p>
                <div className="space-y-2">
                  {serviceFormat.attendanceOptions.map((opt) => {
                    const c = colorMap[opt.color];
                    const sel = attendance === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setAttendance(opt.value);
                          if (opt.value === "●") { setLunch("●"); setTransport("●"); }
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all ${
                          sel ? `${c.bg} ${c.border}` : "bg-white border-slate-200"
                        }`}
                      >
                        <span className={`text-lg font-bold w-6 text-center ${sel ? c.text : "text-slate-400"}`}>
                          {opt.value}
                        </span>
                        <span className={`text-sm font-semibold ${sel ? c.text : "text-slate-600"}`}>
                          {opt.label}
                        </span>
                        {sel && <CheckCircle2 size={16} className={`ml-auto ${c.text}`} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {!isAbsent && (
                <>
                  {serviceFormat.hasLunch && (
                    <div>
                      <p className="text-sm font-bold text-slate-700 mb-2">昼食</p>
                      <div className="flex gap-2">
                        {LUNCH.map((opt) => {
                          const c = colorMap[opt.color];
                          const sel = lunch === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setLunch(opt.value)}
                              className={`flex-1 py-3 rounded-2xl border-2 text-sm font-bold transition-all ${
                                sel ? `${c.bg} ${c.border} ${c.text}` : "bg-white border-slate-200 text-slate-600"
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {serviceFormat.hasTransport && (
                    <div>
                      <p className="text-sm font-bold text-slate-700 mb-2">送迎</p>
                      <div className="space-y-2">
                        {TRANSPORT.map((opt) => {
                          const c = colorMap[opt.color];
                          const sel = transport === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setTransport(opt.value)}
                              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all ${
                                sel ? `${c.bg} ${c.border}` : "bg-white border-slate-200"
                              }`}
                            >
                              <span className={`text-lg font-bold w-6 text-center ${sel ? c.text : "text-slate-400"}`}>
                                {opt.value}
                              </span>
                              <span className={`text-sm font-semibold ${sel ? c.text : "text-slate-600"}`}>
                                {opt.label}
                              </span>
                              {sel && <CheckCircle2 size={16} className={`ml-auto ${c.text}`} />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {serviceFormat.additionalFields?.map((field) => (
                    <div key={field.id}>
                      <p className="text-sm font-bold text-slate-700 mb-2">{field.label}</p>
                      {field.type === "number" && (
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={additionalValues[field.id] ?? ""}
                          onChange={(e) => setAdditionalValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                          placeholder="例: 6"
                          className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
                        />
                      )}
                      {field.type === "text" && (
                        <input
                          type="text"
                          value={additionalValues[field.id] ?? ""}
                          onChange={(e) => setAdditionalValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                          className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
                        />
                      )}
                      {field.type === "radio" && field.options && (
                        <div className="space-y-2">
                          {field.options.map((opt) => {
                            const sel = additionalValues[field.id] === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setAdditionalValues((prev) => ({ ...prev, [field.id]: opt.value }))}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all ${
                                  sel ? "bg-white border-blue-900" : "bg-white border-slate-200"
                                }`}
                              >
                                <span className={`text-sm font-semibold ${sel ? "text-blue-900" : "text-slate-600"}`}>
                                  {opt.label}
                                </span>
                                {sel && <CheckCircle2 size={16} className="ml-auto text-blue-900" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}

              {isAbsent && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
                  <p className="text-sm text-slate-500">欠席のため評価は不要です</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Step: 評価・コメント ── */}
      {step === "eval" && !isAbsent && (
        <div className="space-y-5">
          <div className="mb-2">
            <h2 className="text-lg font-bold text-slate-800">{clientName}さんの様子</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              該当する項目を選び、AIで自然な文章にまとめます
            </p>
          </div>

          {/* 材料：ポジティブ */}
          <div>
            <p className="mb-2 flex items-center">
              <span aria-label="良好" className="text-3xl leading-none">😊</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {allTemplates.positive.map((t) => {
                const sel = selectedItems.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleItem(t)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all active:scale-[0.98] ${
                      sel
                        ? "bg-white text-blue-900 border-blue-900 border-2"
                        : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 flex items-center">
              <span aria-label="普通" className="text-3xl leading-none">🙂</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {allTemplates.neutral.map((t) => {
                const sel = selectedItems.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleItem(t)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all active:scale-[0.98] ${
                      sel
                        ? "bg-white text-blue-900 border-blue-900 border-2"
                        : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 flex items-center">
              <span aria-label="要注意" className="text-3xl leading-none">⚠️</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {allTemplates.concern.map((t) => {
                const sel = selectedItems.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleItem(t)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all active:scale-[0.98] ${
                      sel
                        ? "bg-white text-blue-900 border-blue-900 border-2"
                        : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          {/* メモ */}
          <div>
            <p className="text-xs font-bold text-slate-600 mb-2">メモ（任意・単語や短文でOK）</p>
            <input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="例: 午後に少し疲れた様子"
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
            />
          </div>

          {/* AI 生成ボタン */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || (selectedItems.length === 0 && memo.trim() === "")}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm transition-all ${
              generating || (selectedItems.length === 0 && memo.trim() === "")
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : "bg-blue-900 text-white shadow-sm hover:bg-blue-950 active:scale-[0.98]"
            }`}
          >
            {generating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                AIが文章を整えています...
              </>
            ) : (
              <>
                <Wand2 size={16} />
                AIで文章を整える
              </>
            )}
          </button>

          {/* コメント */}
          <div>
            <p className="text-xs font-bold text-slate-600 mb-2">
              日報コメント（手動で編集できます）
            </p>
            <textarea
              value={finalComment}
              onChange={(e) => setFinalComment(e.target.value)}
              placeholder="「AIで文章を整える」を押すか、直接記入してください"
              rows={5}
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm text-slate-700 placeholder:text-slate-300 resize-none focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
            />
            <div className="flex items-center justify-between mt-1">
              <p
                className={`text-[11px] ${
                  finalComment.trim().length >= COMMENT_MIN_LENGTH
                    ? "text-slate-500"
                    : "text-red-700 font-semibold"
                }`}
              >
                {finalComment.trim().length} 文字
                {finalComment.trim().length < COMMENT_MIN_LENGTH
                  ? `（最低 ${COMMENT_MIN_LENGTH} 文字以上 / 目安 100 文字）`
                  : `（目安 100 文字）`}
              </p>
              {finalComment && (
                <button
                  type="button"
                  onClick={() => setFinalComment("")}
                  className="text-xs text-slate-500 hover:text-red-700"
                >
                  クリア
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {step === "eval" && isAbsent && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <User size={28} className="text-slate-400" />
          </div>
          <p className="text-slate-600 font-semibold">{clientName}さんは欠席</p>
          <p className="text-sm text-slate-400 mt-1">評価入力は不要です。このまま送信してください。</p>
        </div>
      )}

      {/* ── ナビゲーションボタン ── */}
      <div
        className="fixed bottom-0 left-0 right-0 px-4 pt-4 bg-white border-t border-slate-200 shadow-lg"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 1rem)" }}
      >
        <div className="w-full md:max-w-lg md:mx-auto flex gap-3">
          {step !== "date" && (
            <button
              type="button"
              onClick={back}
              className="flex items-center gap-1 px-4 py-4 rounded-2xl bg-white border border-slate-300 text-slate-700 font-bold text-sm hover:bg-slate-50"
            >
              <ChevronLeft size={16} />
              戻る
            </button>
          )}

          {step !== "eval" ? (
            <button
              type="button"
              onClick={next}
              disabled={!canNext[step]}
              className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-sm transition-all ${
                canNext[step]
                  ? "bg-blue-900 text-white shadow-sm hover:bg-blue-950 active:scale-[0.98]"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
              }`}
            >
              次へ
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canNext["eval"] || loading}
              className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-sm transition-all ${
                canNext["eval"] && !loading
                  ? "bg-blue-900 text-white shadow-sm hover:bg-blue-950 active:scale-[0.98]"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
              }`}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  保存中...
                </span>
              ) : (
                <>
                  <Send size={16} />
                  送信する
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
