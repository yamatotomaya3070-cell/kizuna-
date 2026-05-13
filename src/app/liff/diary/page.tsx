"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Send,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Loader2,
  AlertCircle,
  MessageCircle,
} from "lucide-react";
import { B_TYPE_FORMAT, getServiceFormat, type ServiceFormat } from "@/data/service-formats";

// ────────────────────────────────────────────
// 定数・型
// ────────────────────────────────────────────

const LUNCH = [
  { value: "○", label: "○ 加算対象", color: "emerald" },
  { value: "●", label: "● なし", color: "slate" },
];

const TRANSPORT = [
  { value: "○", label: "○ 送迎両方", color: "emerald" },
  { value: "△", label: "△ どちらか", color: "amber" },
  { value: "●", label: "● なし", color: "slate" },
];

const colorMap: Record<string, { bg: string; border: string; text: string; pill: string }> = {
  emerald: { bg: "bg-blue-50", border: "border-blue-400", text: "text-blue-900", pill: "bg-blue-900" },
  amber:   { bg: "bg-slate-50",   border: "border-slate-400",   text: "text-slate-700",   pill: "bg-slate-500" },
  red:     { bg: "bg-red-50",     border: "border-red-400",     text: "text-red-700",      pill: "bg-red-500" },
  slate:   { bg: "bg-slate-50",   border: "border-slate-300",   text: "text-slate-600",    pill: "bg-slate-400" },
  blue:    { bg: "bg-blue-50",    border: "border-blue-400",    text: "text-blue-900",     pill: "bg-blue-900" },
};

type Step = "client" | "basic" | "eval" | "done";

type AttendanceRecord = {
  attendance: string;
  lunch: string;
  transport: string;
};

type StaffInfo = {
  staffName: string;
  role: string;
  facilityId: string;
  facilityName: string;
  serviceType: string;
  clients: string[];
};

// ────────────────────────────────────────────
// ステップインジケーター（3ステップ）
// ────────────────────────────────────────────

const LIFF_STEPS = [
  { key: "client", label: "利用者" },
  { key: "basic",  label: "基本情報" },
  { key: "eval",   label: "評価" },
];

function StepBar({ current }: { current: Step }) {
  const idx = LIFF_STEPS.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center gap-1">
      {LIFF_STEPS.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              i < idx
                ? "bg-blue-900 text-white"
                : i === idx
                ? "bg-blue-900 text-white"
                : "bg-slate-100 text-slate-400"
            }`}
          >
            {i < idx ? <CheckCircle2 size={13} /> : i + 1}
          </div>
          {i < LIFF_STEPS.length - 1 && (
            <div className={`h-0.5 w-4 rounded ${i < idx ? "bg-blue-400" : "bg-slate-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────
// 選択ボタン
// ────────────────────────────────────────────

function OptionBtn({
  selected,
  onClick,
  children,
  color = "blue",
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: string;
}) {
  const c = colorMap[color] ?? colorMap.blue;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 text-left transition-all active:scale-[0.98] ${
        selected ? `${c.bg} ${c.border}` : "bg-white border-slate-100 hover:border-slate-200"
      }`}
    >
      <span
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
          selected ? `${c.pill} border-transparent` : "border-slate-300"
        }`}
      >
        {selected && <span className="w-2 h-2 rounded-full bg-white" />}
      </span>
      <span className={`text-sm font-semibold ${selected ? c.text : "text-slate-700"}`}>
        {children}
      </span>
      {selected && <CheckCircle2 size={16} className={`ml-auto shrink-0 ${c.text}`} />}
    </button>
  );
}

// ────────────────────────────────────────────
// メインページ
// ────────────────────────────────────────────

export default function LiffDiaryPage() {
  const today = new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  // LIFF状態
  const [liffState, setLiffState] = useState<"loading" | "registering" | "ready" | "error">("loading");
  const [liffError, setLiffError] = useState("");
  const [lineUserId, setLineUserId] = useState("");
  const [staffInfo, setStaffInfo] = useState<StaffInfo | null>(null);
  const [serviceFormat, setServiceFormat] = useState<ServiceFormat>(B_TYPE_FORMAT);

  // フォーム状態
  const [step, setStep] = useState<Step>("client");
  const [clientName, setClientName] = useState("");
  const [attendance, setAttendance] = useState("");
  const [lunch, setLunch] = useState("");
  const [transport, setTransport] = useState("");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const [adminAttendance, setAdminAttendance] = useState<AttendanceRecord | null>(null);
  const [loadingAdminAttendance, setLoadingAdminAttendance] = useState(false);
  const [additionalValues, setAdditionalValues] = useState<Record<string, string>>({});

  // LIFF初期化
  useEffect(() => {
    const init = async () => {
      try {
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! });

        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }

        const profile = await liff.getProfile();
        const userId = profile.userId;
        setLineUserId(userId);

        // 登録トークンの確認
        const params = new URLSearchParams(window.location.search);
        const token = params.get("token");

        if (token) {
          setLiffState("registering");
          const res = await fetch("/api/liff/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, lineUserId: userId }),
          });
          const data = await res.json();
          if (!res.ok) {
            setLiffError(
              data.error === "invalid_token"
                ? "このQRコードは無効または期限切れです。管理者に再発行を依頼してください。"
                : "LINE連携の登録に失敗しました。"
            );
            setLiffState("error");
            return;
          }
        }

        // スタッフ情報取得
        const authRes = await fetch(`/api/liff/auth?lineUserId=${userId}`);
        const authData = await authRes.json();

        if (!authRes.ok) {
          setLiffError(
            authData.error === "not_registered"
              ? "このLINEアカウントは連携されていません。管理者に設定を依頼してください。"
              : "認証に失敗しました。"
          );
          setLiffState("error");
          return;
        }

        setStaffInfo(authData);
        setServiceFormat(getServiceFormat(authData.serviceType));
        setLiffState("ready");
      } catch {
        setLiffError("LIFFの初期化に失敗しました。LINEアプリから開いてください。");
        setLiffState("error");
      }
    };

    init();
  }, []);

  // 利用者選択時に出欠情報を取得
  useEffect(() => {
    if (!clientName || !lineUserId) {
      setAdminAttendance(null);
      return;
    }
    const date = new Date().toISOString().slice(0, 10);
    setLoadingAdminAttendance(true);

    fetch(
      `/api/liff/attendance?lineUserId=${lineUserId}&clientName=${encodeURIComponent(clientName)}&date=${date}`
    )
      .then((r) => r.json())
      .then((data) => {
        setAdminAttendance(data.attendance ?? null);
        if (data.attendance) {
          setAttendance(data.attendance.attendance);
          setLunch(data.attendance.lunch);
          setTransport(data.attendance.transport);
        } else {
          setAttendance("");
          setLunch("");
          setTransport("");
        }
        setLoadingAdminAttendance(false);
      })
      .catch(() => setLoadingAdminAttendance(false));
  }, [clientName, lineUserId]);

  const isAbsent = attendance === "●";

  const canNext: Record<Step, boolean> = {
    client: clientName !== "",
    basic:
      adminAttendance != null
        ? true
        : attendance !== "" && (isAbsent || (lunch !== "" && transport !== "")),
    eval: isAbsent || comment !== "",
    done: true,
  };

  const STEPS: Step[] = ["client", "basic", "eval", "done"];

  const next = () => {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  };

  const back = () => {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  };

  const addTemplate = (text: string) => {
    setComment((prev) => (prev ? prev + "。" + text : text));
  };

  const handleSubmit = async () => {
    if (!lineUserId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/liff/save-diary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineUserId,
          clientName,
          attendance,
          lunch,
          transport,
          comment,
          additionalValues,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert("保存に失敗しました: " + (data.error ?? ""));
        return;
      }
      setDoneCount((n) => n + 1);
      setStep("done");
    } catch {
      alert("保存に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const resetForNext = () => {
    setClientName("");
    setAttendance("");
    setLunch("");
    setTransport("");
    setComment("");
    setAdditionalValues({});
    setAdminAttendance(null);
    setStep("client");
  };

  const closeLiff = async () => {
    try {
      const liff = (await import("@line/liff")).default;
      if (liff.isInClient()) {
        liff.closeWindow();
      }
    } catch { /* ignore */ }
  };

  // ── ローディング・登録中 ──
  if (liffState === "loading" || liffState === "registering") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-white">
        <Loader2 size={32} className="animate-spin text-blue-900 mb-4" />
        <p className="text-sm text-slate-600 font-medium">
          {liffState === "registering" ? "LINE連携を設定中..." : "読み込み中..."}
        </p>
      </div>
    );
  }

  // ── エラー ──
  if (liffState === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-white">
        <AlertCircle size={40} className="text-red-400 mb-4" />
        <p className="text-base font-bold text-slate-800 mb-2">エラーが発生しました</p>
        <p className="text-sm text-slate-500 leading-relaxed">{liffError}</p>
      </div>
    );
  }

  const activeRole = staffInfo
    ? serviceFormat.roles.find((r) => r.id === staffInfo.role)
    : null;
  const templates = activeRole?.templates ?? null;

  // ── 完了画面 ──
  if (step === "done") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-white">
        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-5">
          <CheckCircle2 size={40} className="text-blue-900" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-1">送信完了</h2>
        <p className="text-sm text-slate-500 mb-1">{clientName}さんの日報を保存しました</p>
        <p className="text-xs text-slate-400 mb-2">
          {today}　記録者: {staffInfo?.staffName}
        </p>
        <span className="text-xs font-bold bg-blue-100 text-blue-900 px-3 py-1 rounded-full mb-8">
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
            onClick={closeLiff}
            className="w-full py-3.5 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm flex items-center justify-center gap-2"
          >
            <MessageCircle size={16} />
            LINEに戻る
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
            <h1 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <MessageCircle size={16} className="text-blue-900" />
              LINE 日報入力
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {today}　{staffInfo?.staffName}（{activeRole?.label ?? staffInfo?.role}）
            </p>
          </div>
          {doneCount > 0 && (
            <span className="text-xs font-bold bg-blue-100 text-blue-900 px-2.5 py-1 rounded-full">
              {doneCount}名完了
            </span>
          )}
        </div>
        <StepBar current={step} />
      </div>

      {/* ── Step: 利用者選択 ── */}
      {step === "client" && (
        <div>
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-800">誰を記録しますか？</h2>
            <p className="text-xs text-slate-500 mt-0.5">利用者を1名選んでください</p>
          </div>
          {(staffInfo?.clients.length ?? 0) === 0 ? (
            <p className="text-center py-12 text-slate-400 text-sm">
              利用者が登録されていません。
              <br />
              管理者に追加を依頼してください。
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {staffInfo?.clients.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setClientName(name)}
                  className={`py-3.5 px-3 rounded-2xl border-2 text-sm font-bold transition-all active:scale-[0.97] ${
                    clientName === name
                      ? "bg-blue-50 border-blue-900 text-blue-900"
                      : "bg-white border-slate-100 text-slate-700 hover:border-slate-200"
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
            <h2 className="text-lg font-bold text-slate-800">{clientName}さん</h2>
            <p className="text-xs text-slate-500 mt-0.5">本日の基本情報を入力してください</p>
          </div>

          {loadingAdminAttendance ? (
            <div className="flex justify-center py-8">
              <Loader2 size={22} className="animate-spin text-slate-300" />
            </div>
          ) : adminAttendance ? (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 flex items-center gap-2">
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
                    <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 ${c.bg} ${c.border}`}>
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
              {/* 出欠 */}
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
                          sel ? `${c.bg} ${c.border}` : "bg-white border-slate-100"
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
                                sel ? `${c.bg} ${c.border} ${c.text}` : "bg-white border-slate-100 text-slate-600"
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
                                sel ? `${c.bg} ${c.border}` : "bg-white border-slate-100"
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
                          onChange={(e) =>
                            setAdditionalValues((prev) => ({ ...prev, [field.id]: e.target.value }))
                          }
                          className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                        />
                      )}
                      {field.type === "text" && (
                        <input
                          type="text"
                          value={additionalValues[field.id] ?? ""}
                          onChange={(e) =>
                            setAdditionalValues((prev) => ({ ...prev, [field.id]: e.target.value }))
                          }
                          className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
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
                                onClick={() =>
                                  setAdditionalValues((prev) => ({ ...prev, [field.id]: opt.value }))
                                }
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all ${
                                  sel ? "bg-blue-50 border-blue-400" : "bg-white border-slate-100"
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
      {step === "eval" && !isAbsent && templates && (
        <div className="space-y-5">
          <div className="mb-2">
            <h2 className="text-lg font-bold text-slate-800">{clientName}さんの評価</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeRole?.description ?? "評価を入力してください"}
            </p>
          </div>

          <div>
            <p className="text-xs font-bold text-blue-900 mb-2 flex items-center gap-1">
              <Sparkles size={12} />
              良好
            </p>
            <div className="space-y-1.5">
              {templates.positive.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => addTemplate(t)}
                  className="w-full text-left px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-800 hover:bg-blue-100 transition-all active:scale-[0.98]"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-blue-900 mb-2 flex items-center gap-1">
              <Sparkles size={12} />
              普通
            </p>
            <div className="space-y-1.5">
              {templates.neutral.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => addTemplate(t)}
                  className="w-full text-left px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-800 hover:bg-blue-100 transition-all active:scale-[0.98]"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-slate-600 mb-2 flex items-center gap-1">
              <Sparkles size={12} />
              要注意
            </p>
            <div className="space-y-1.5">
              {templates.concern.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => addTemplate(t)}
                  className="w-full text-left px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 hover:bg-slate-100 transition-all active:scale-[0.98]"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-slate-600 mb-2">コメント（タップで追記・直接編集可）</p>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="上の定型文をタップすると自動入力されます"
              rows={4}
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm text-slate-700 placeholder:text-slate-300 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            {comment && (
              <button
                type="button"
                onClick={() => setComment("")}
                className="mt-1 text-xs text-slate-400 hover:text-red-400"
              >
                クリア
              </button>
            )}
          </div>
        </div>
      )}

      {step === "eval" && isAbsent && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl">😔</span>
          </div>
          <p className="text-slate-600 font-semibold">{clientName}さんは欠席</p>
          <p className="text-sm text-slate-400 mt-1">評価入力は不要です。このまま送信してください。</p>
        </div>
      )}

      {/* ── ナビゲーション ── */}
      <div
        className="fixed bottom-0 left-0 right-0 px-4 pt-4 bg-white border-t border-slate-200 shadow-lg"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 1rem)" }}
      >
        <div className="w-full md:max-w-lg md:mx-auto flex gap-3">
          {step !== "client" && (
            <button
              type="button"
              onClick={back}
              className="flex items-center gap-1 px-4 py-4 rounded-2xl bg-slate-100 text-slate-600 font-bold text-sm"
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
                  ? "bg-blue-900 text-white shadow-md active:scale-[0.98]"
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
                  ? "bg-blue-900 text-white shadow-md active:scale-[0.98]"
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
