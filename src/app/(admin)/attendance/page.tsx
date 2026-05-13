"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { CalendarCheck, ChevronLeft, ChevronRight, Save, Loader2, CheckCircle2, UserPlus } from "lucide-react";
import { getAttendance, saveAttendance, type AttendanceRecord } from "@/app/actions/attendance";
import { createClient } from "@/lib/supabase/client";

const ATTENDANCE_OPTS = [
  { value: "○", label: "出席", color: "emerald" },
  { value: "△", label: "遅刻・早退", color: "amber" },
  { value: "●", label: "欠席", color: "red" },
];

const LUNCH_OPTS = [
  { value: "○", label: "○", color: "emerald" },
  { value: "●", label: "●", color: "slate" },
];

const TRANSPORT_OPTS = [
  { value: "○", label: "○", color: "emerald" },
  { value: "△", label: "△", color: "amber" },
  { value: "●", label: "●", color: "slate" },
];

const COLOR = {
  emerald: { bg: "bg-blue-900", ring: "ring-blue-400", text: "text-white" },
  amber:   { bg: "bg-slate-400",   ring: "ring-slate-300",   text: "text-white" },
  red:     { bg: "bg-red-500",     ring: "ring-red-400",     text: "text-white" },
  slate:   { bg: "bg-slate-400",   ring: "ring-slate-300",   text: "text-white" },
};

function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateJa(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
}

type RowState = { attendance: string; lunch: string; transport: string };

function ToggleGroup({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string; color: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {options.map((opt) => {
        const c = COLOR[opt.color as keyof typeof COLOR];
        const sel = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`w-10 h-10 rounded-xl text-sm font-bold transition-all active:scale-95 ${
              sel
                ? `${c.bg} ${c.text} ring-2 ${c.ring} ring-offset-1`
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default function AttendancePage() {
  const today = toLocalDateStr(new Date());
  const [date, setDate] = useState(today);
  const [clients, setClients] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchClients = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("facility_id").eq("id", user.id).single();
    const { data } = await supabase
      .from("clients")
      .select("name")
      .eq("facility_id", profile?.facility_id)
      .eq("status", "active")
      .order("name");
    setClients(data?.map((c: { name: string }) => c.name) ?? []);
    if (!data || data.length === 0) setLoading(false);
  }, []);

  const fetchAttendance = useCallback(async (d: string, clientList: string[]) => {
    setLoading(true);
    const { data } = await getAttendance(d);

    const existing: Record<string, RowState> = {};
    data?.forEach((r: AttendanceRecord) => {
      existing[r.client_name] = { attendance: r.attendance, lunch: r.lunch, transport: r.transport };
    });

    const initialRows: Record<string, RowState> = {};
    clientList.forEach((name) => {
      initialRows[name] = existing[name] ?? { attendance: "○", lunch: "○", transport: "○" };
    });
    setRows(initialRows);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchClients().then(() => {});
  }, [fetchClients]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (clients.length > 0) fetchAttendance(date, clients);
  }, [date, clients, fetchAttendance]);

  const updateRow = (name: string, field: keyof RowState, value: string) => {
    setSaved(false);
    setRows((prev) => {
      const row = { ...prev[name], [field]: value };
      if (field === "attendance" && value === "●") {
        row.lunch = "●";
        row.transport = "●";
      }
      return { ...prev, [name]: row };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    const records: AttendanceRecord[] = Object.entries(rows).map(([client_name, r]) => ({
      client_name,
      attendance: r.attendance,
      lunch: r.lunch,
      transport: r.transport,
    }));
    const result = await saveAttendance(date, records);
    setSaving(false);
    if (result.error) {
      alert("保存に失敗しました: " + result.error);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const shiftDate = (days: number) => {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + days);
    setDate(toLocalDateStr(d));
    setSaved(false);
  };

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto pb-32">
      {/* ヘッダー */}
      <div className="mb-6">
        <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
          <CalendarCheck size={18} className="text-blue-900" />
          出欠入力
        </h1>

        {/* 日付選択 */}
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-3 py-2 shadow-sm w-fit">
          <button
            type="button"
            onClick={() => shiftDate(-1)}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <ChevronLeft size={16} className="text-slate-500" />
          </button>
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => { setDate(e.target.value); setSaved(false); }}
            className="text-sm font-semibold text-slate-700 bg-transparent border-none outline-none cursor-pointer"
          />
          <button
            type="button"
            onClick={() => shiftDate(1)}
            disabled={date >= today}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-30"
          >
            <ChevronRight size={16} className="text-slate-500" />
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-1.5 ml-1">{formatDateJa(date)}</p>
      </div>

      {/* 凡例 */}
      <div className="flex gap-4 mb-4 text-xs text-slate-500 flex-wrap">
        <span className="font-semibold text-slate-600">出欠 / 昼食 / 送迎</span>
        <span><span className="font-bold text-blue-900">○</span> 出席・あり</span>
        <span><span className="font-bold text-slate-500">△</span> 遅刻・早退 / 片道</span>
        <span><span className="font-bold text-red-500">●</span> 欠席・なし</span>
      </div>

      {/* カード一覧 */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-slate-300" />
        </div>
      ) : clients.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">
          <p>利用者が登録されていません。</p>
          <Link
            href="/clients"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-900"
          >
            <UserPlus size={14} />
            利用者管理から利用者を登録してください
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {clients.map((name) => {
            const row = rows[name] ?? { attendance: "○", lunch: "○", transport: "○" };
            const absent = row.attendance === "●";
            return (
              <div
                key={name}
                className={`bg-white border rounded-2xl p-4 shadow-sm transition-all ${
                  absent ? "border-red-200 bg-red-50/30" : "border-slate-200"
                }`}
              >
                <p className="font-bold text-slate-800 mb-3 text-sm">{name}</p>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 w-10">出欠</span>
                    <ToggleGroup
                      options={ATTENDANCE_OPTS}
                      value={row.attendance}
                      onChange={(v) => updateRow(name, "attendance", v)}
                    />
                  </div>
                  <div className={`flex items-center justify-between transition-opacity ${absent ? "opacity-30 pointer-events-none" : ""}`}>
                    <span className="text-xs text-slate-500 w-10">昼食</span>
                    <ToggleGroup
                      options={LUNCH_OPTS}
                      value={row.lunch}
                      onChange={(v) => updateRow(name, "lunch", v)}
                    />
                  </div>
                  <div className={`flex items-center justify-between transition-opacity ${absent ? "opacity-30 pointer-events-none" : ""}`}>
                    <span className="text-xs text-slate-500 w-10">送迎</span>
                    <ToggleGroup
                      options={TRANSPORT_OPTS}
                      value={row.transport}
                      onChange={(v) => updateRow(name, "transport", v)}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 固定フッター：一括保存 */}
      {!loading && clients.length > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 px-4 pt-4 bg-white border-t border-slate-200 shadow-lg"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 1rem)" }}
        >
          <div className="max-w-2xl mx-auto">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-sm transition-all ${
                saved
                  ? "bg-blue-900 text-white"
                  : saving
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                  : "bg-blue-900 text-white shadow-md active:scale-[0.98]"
              }`}
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  保存中...
                </>
              ) : saved ? (
                <>
                  <CheckCircle2 size={16} />
                  保存しました
                </>
              ) : (
                <>
                  <Save size={16} />
                  一括保存
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
