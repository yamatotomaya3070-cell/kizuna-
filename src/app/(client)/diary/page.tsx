"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Send,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  User,
  Users,
  ClipboardList,
  Loader2,
} from "lucide-react";
import { saveDiary } from "@/app/actions/diary";
import { getAttendanceForClient, type AttendanceRecord } from "@/app/actions/attendance";
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

type Role = "work" | "life";
type Step = "role" | "staff" | "client" | "basic" | "eval" | "done";

const colorMap: Record<string, { bg: string; border: string; text: string; pill: string }> = {
  emerald: { bg: "bg-emerald-50", border: "border-emerald-400", text: "text-emerald-700", pill: "bg-emerald-500" },
  amber:   { bg: "bg-amber-50",   border: "border-amber-400",   text: "text-amber-700",   pill: "bg-amber-500" },
  red:     { bg: "bg-red-50",     border: "border-red-400",     text: "text-red-700",      pill: "bg-red-500" },
  slate:   { bg: "bg-slate-50",   border: "border-slate-300",   text: "text-slate-600",    pill: "bg-slate-400" },
  blue:    { bg: "bg-blue-50",    border: "border-blue-400",    text: "text-blue-700",     pill: "bg-blue-500" },
};

// ─────────────────────────────────────────
// ステップインジケーター
// ─────────────────────────────────────────

const STEPS: { key: Step; label: string }[] = [
  { key: "role", label: "役職" },
  { key: "staff", label: "記録者" },
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
                ? "bg-emerald-500 text-white"
                : i === idx
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-400"
            }`}
          >
            {i < idx ? <CheckCircle2 size={13} /> : i + 1}
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-0.5 w-4 rounded ${i < idx ? "bg-emerald-400" : "bg-slate-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────
// 選択ボタン
// ─────────────────────────────────────────

function OptionBtn({
  selected, onClick, children, color = "blue",
}: {
  selected: boolean; onClick: () => void; children: React.ReactNode; color?: string;
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
      <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
        selected ? `${c.pill} border-transparent` : "border-slate-300"
      }`}>
        {selected && <span className="w-2 h-2 rounded-full bg-white" />}
      </span>
      <span className={`text-sm font-semibold ${selected ? c.text : "text-slate-700"}`}>
        {children}
      </span>
      {selected && <CheckCircle2 size={16} className={`ml-auto shrink-0 ${c.text}`} />}
    </button>
  );
}

// ─────────────────────────────────────────
// メインページ
// ─────────────────────────────────────────

export default function DiaryPage() {
  const today = new Date().toLocaleDateString("ja-JP", {
    year: "numeric", month: "long", day: "numeric", weekday: "short",
  });

  const [step, setStep] = useState<Step>("role");
  const [role, setRole] = useState<Role | "">("");
  const [staffName, setStaffName] = useState("");
  const [clientName, setClientName] = useState("");
  const [attendance, setAttendance] = useState("");
  const [lunch, setLunch] = useState("");
  const [transport, setTransport] = useState("");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const [clients, setClients] = useState<string[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [staffByRole, setStaffByRole] = useState<Record<"work" | "life", string[]>>({ work: [], life: [] });
  const [adminAttendance, setAdminAttendance] = useState<AttendanceRecord | null>(null);
  const [loadingAdminAttendance, setLoadingAdminAttendance] = useState(false);
  const [serviceFormat, setServiceFormat] = useState<ServiceFormat>(B_TYPE_FORMAT);
  const [additionalValues, setAdditionalValues] = useState<Record<string, string>>({});

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
      const serviceType = (profile?.facilities as { service_type?: string } | null)?.service_type ?? 'b_type';
      setServiceFormat(getServiceFormat(serviceType));

      const [{ data: clientData }, { data: staffData }] = await Promise.all([
        supabase.from("clients").select("name").eq("facility_id", facilityId).eq("status", "active").order("name"),
        supabase.from("staff").select("name, role").eq("facility_id", facilityId).order("name"),
      ]);

      setClients(clientData?.map((c) => c.name) ?? []);
      setStaffByRole({
        work: staffData?.filter((s) => s.role === "work").map((s) => s.name) ?? [],
        life: staffData?.filter((s) => s.role === "life").map((s) => s.name) ?? [],
      });
      setLoadingClients(false);
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (!clientName) { setAdminAttendance(null); return; }
    const today = new Date().toISOString().slice(0, 10);
    setLoadingAdminAttendance(true);
    getAttendanceForClient(clientName, today).then(({ data }) => {
      setAdminAttendance(data);
      if (data) {
        setAttendance(data.attendance);
        setLunch(data.lunch);
        setTransport(data.transport);
      }
      setLoadingAdminAttendance(false);
    });
  }, [clientName]);

  const isAbsent = attendance === "●";

  const canNext: Record<Step, boolean> = {
    role:   role !== "",
    staff:  staffName !== "",
    client: clientName !== "",
    basic:  adminAttendance != null
              ? true
              : attendance !== "" && (isAbsent || (lunch !== "" && transport !== "")),
    eval:   isAbsent || comment !== "",
    done:   true,
  };

  const next = () => {
    const order: Step[] = ["role", "staff", "client", "basic", "eval", "done"];
    const idx = order.indexOf(step);
    if (idx < order.length - 1) setStep(order[idx + 1]);
  };

  const back = () => {
    const order: Step[] = ["role", "staff", "client", "basic", "eval", "done"];
    const idx = order.indexOf(step);
    if (idx > 0) setStep(order[idx - 1]);
  };

  const addTemplate = (text: string) => {
    setComment((prev) => prev ? prev + "。" + text : text);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await saveDiary({
        clientName,
        staffName,
        attendance,
        breakfast: lunch,
        sleep: transport,
        ratings: { ...additionalValues, eval: comment },
        comments: { role: role as string },
      });
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

  const resetAll = () => {
    setRole("");
    setStaffName("");
    setClientName("");
    setAttendance("");
    setLunch("");
    setTransport("");
    setComment("");
    setAdditionalValues({});
    setAdminAttendance(null);
    setDoneCount(0);
    setStep("role");
  };

  // ── 完了画面 ──
  if (step === "done") {
    return (
      <div className="min-h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-5">
          <CheckCircle2 size={40} className="text-emerald-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-1">送信完了</h2>
        <p className="text-sm text-slate-500 mb-1">{clientName}さんの日報を保存しました</p>
        <p className="text-xs text-slate-400 mb-2">{today}　記録者: {staffName}</p>
        <span className="text-xs font-bold bg-blue-100 text-blue-700 px-3 py-1 rounded-full mb-8">
          本日 {doneCount}名 完了
        </span>
        <div className="w-full max-w-xs space-y-3">
          <button
            onClick={resetForNext}
            className="w-full py-3.5 bg-blue-600 text-white rounded-2xl font-bold text-sm"
          >
            次の利用者を入力
          </button>
          <button
            onClick={resetAll}
            className="w-full py-3.5 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm"
          >
            最初に戻る
          </button>
        </div>
      </div>
    );
  }

  const activeRole = role ? serviceFormat.roles.find((r) => r.id === role) : null;
  const templates = activeRole?.templates ?? null;

  return (
    <div className="w-full px-4 pt-5 pb-32 md:max-w-lg md:mx-auto">
      {/* ヘッダー */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <ClipboardList size={16} className="text-blue-500" />
              日報入力
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">{today}</p>
          </div>
          <div className="flex items-center gap-2">
            {doneCount > 0 && (
              <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">
                {doneCount}名完了
              </span>
            )}
            <Link
              href="/diary/batch"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200 transition-colors"
            >
              <Users size={12} />
              一括入力
            </Link>
          </div>
        </div>
        <StepBar current={step} />
      </div>

      {/* ── Step: 役職選択 ── */}
      {step === "role" && (
        <div className="space-y-3">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-800">あなたの役職は？</h2>
            <p className="text-xs text-slate-500 mt-0.5">評価内容が役職に合わせて変わります</p>
          </div>
          {serviceFormat.roles.map((r, i) => {
            const isSelected = role === r.id;
            const colorClass = i === 0
              ? { bg: "bg-blue-50", border: "border-blue-500", icon: "bg-blue-500", check: "text-blue-500" }
              : { bg: "bg-indigo-50", border: "border-indigo-500", icon: "bg-indigo-500", check: "text-indigo-500" };
            const Icon = i === 0 ? ClipboardList : Users;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => { setRole(r.id as Role); setStaffName(""); }}
                className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 transition-all active:scale-[0.98] ${
                  isSelected ? `${colorClass.bg} ${colorClass.border}` : "bg-white border-slate-100"
                }`}
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                  isSelected ? colorClass.icon : "bg-slate-100"
                }`}>
                  <Icon size={20} className={isSelected ? "text-white" : "text-slate-500"} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-slate-800">{r.label}</p>
                  <p className="text-xs text-slate-500">{r.description}</p>
                </div>
                {isSelected && <CheckCircle2 size={18} className={`${colorClass.check} ml-auto`} />}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Step: 記録者選択 ── */}
      {step === "staff" && role && (
        <div className="space-y-2">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-800">あなたの名前は？</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeRole?.label ?? role}として記録します
            </p>
          </div>
          {loadingClients ? (
            <div className="flex justify-center py-8">
              <Loader2 size={22} className="animate-spin text-slate-300" />
            </div>
          ) : staffByRole[role as Role].length === 0 ? (
            <p className="text-center py-8 text-slate-400 text-sm">
              指導員が登録されていません。設定から追加してください。
            </p>
          ) : (
            staffByRole[role as Role].map((name) => (
              <OptionBtn key={name} selected={staffName === name} onClick={() => setStaffName(name)}>
                {name}
              </OptionBtn>
            ))
          )}
        </div>
      )}

      {/* ── Step: 利用者選択 ── */}
      {step === "client" && (
        <div>
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-800">誰を記録しますか？</h2>
            <p className="text-xs text-slate-500 mt-0.5">利用者を1名選んでください</p>
          </div>
          {loadingClients ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-slate-300" />
            </div>
          ) : clients.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              利用者が登録されていません。<br />管理者に追加を依頼してください。
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {clients.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setClientName(name)}
                  className={`py-3.5 px-3 rounded-2xl border-2 text-sm font-bold transition-all active:scale-[0.97] ${
                    clientName === name
                      ? "bg-blue-50 border-blue-500 text-blue-700"
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
            /* 管理者入力済み：読み取り専用表示 */
            <div className="space-y-4">
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3 flex items-center gap-2">
                <CheckCircle2 size={15} className="text-indigo-500 shrink-0" />
                <p className="text-xs font-semibold text-indigo-700">管理者が入力済みです</p>
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
            /* 未入力：従来通り入力可能 */
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

              {/* 欠席以外のみ表示 */}
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

                  {/* 事業種別固有の追加フィールド */}
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
                          className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                        />
                      )}
                      {field.type === "text" && (
                        <input
                          type="text"
                          value={additionalValues[field.id] ?? ""}
                          onChange={(e) => setAdditionalValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
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
                                onClick={() => setAdditionalValues((prev) => ({ ...prev, [field.id]: opt.value }))}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all ${
                                  sel ? "bg-blue-50 border-blue-400" : "bg-white border-slate-100"
                                }`}
                              >
                                <span className={`text-sm font-semibold ${sel ? "text-blue-700" : "text-slate-600"}`}>
                                  {opt.label}
                                </span>
                                {sel && <CheckCircle2 size={16} className="ml-auto text-blue-500" />}
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

          {/* 定型文（ポジティブ） */}
          <div>
            <p className="text-xs font-bold text-emerald-600 mb-2 flex items-center gap-1">
              <Sparkles size={12} />
              良好
            </p>
            <div className="space-y-1.5">
              {templates.positive.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => addTemplate(t)}
                  className="w-full text-left px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 hover:bg-emerald-100 transition-all active:scale-[0.98]"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-blue-600 mb-2 flex items-center gap-1">
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
            <p className="text-xs font-bold text-amber-600 mb-2 flex items-center gap-1">
              <Sparkles size={12} />
              要注意
            </p>
            <div className="space-y-1.5">
              {templates.concern.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => addTemplate(t)}
                  className="w-full text-left px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800 hover:bg-amber-100 transition-all active:scale-[0.98]"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* 入力欄 */}
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
          {step !== "role" && (
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
                  ? "bg-blue-600 text-white shadow-md active:scale-[0.98]"
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
                  ? "bg-blue-600 text-white shadow-md active:scale-[0.98]"
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
