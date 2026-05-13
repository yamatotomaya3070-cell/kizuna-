"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ClipboardList,
  CheckCircle2,
  Loader2,
  Save,
  Users,
} from "lucide-react";
import { saveDiaryBatch } from "@/app/actions/diary";
import { createClient } from "@/lib/supabase/client";
import { B_TYPE_FORMAT, getServiceFormat, type ServiceFormat } from "@/data/service-formats";

type Role = "work" | "life";

type ClientEntry = {
  name: string;
  comment: string;
  attendance: string | null;
  alreadyEntered: boolean;
};

export default function BatchDiaryPage() {
  const today = new Date().toLocaleDateString("ja-JP", {
    year: "numeric", month: "long", day: "numeric", weekday: "short",
  });
  const todayISO = new Date().toISOString().slice(0, 10);

  const [role, setRole] = useState<Role | "">("");
  const [staffName, setStaffName] = useState("");
  const [serviceFormat, setServiceFormat] = useState<ServiceFormat>(B_TYPE_FORMAT);
  const [staffByRole, setStaffByRole] = useState<Record<Role, string[]>>({ work: [], life: [] });
  const [entries, setEntries] = useState<ClientEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("facility_id, facilities(service_type)")
        .eq("id", user.id)
        .single();

      const facilityId = profile?.facility_id;
      const serviceType = (profile?.facilities as { service_type?: string } | null)?.service_type ?? "b_type";
      setServiceFormat(getServiceFormat(serviceType));

      const [{ data: clientData }, { data: staffData }, { data: attendanceData }] = await Promise.all([
        supabase.from("clients").select("name").eq("facility_id", facilityId).eq("status", "active").order("name"),
        supabase.from("staff").select("name, role").eq("facility_id", facilityId).order("name"),
        supabase.from("daily_attendance")
          .select("client_name, attendance")
          .eq("facility_id", facilityId)
          .eq("recorded_date", todayISO),
      ]);

      const attendanceMap = new Map((attendanceData ?? []).map((a) => [a.client_name, a.attendance]));

      setEntries(
        (clientData ?? []).map((c) => ({
          name: c.name,
          comment: "",
          attendance: attendanceMap.get(c.name) ?? null,
          alreadyEntered: false,
        }))
      );
      setStaffByRole({
        work: staffData?.filter((s) => s.role === "work").map((s) => s.name) ?? [],
        life: staffData?.filter((s) => s.role === "life").map((s) => s.name) ?? [],
      });
      setLoading(false);
    };

    load();
  }, [todayISO]);

  // 入力済みチェック（role + staff が確定したとき）
  useEffect(() => {
    if (!role || !staffName) return;

    const check = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("facility_id")
        .eq("id", user.id)
        .single();

      const facilityId = profile?.facility_id;
      if (!facilityId) return;

      const { data: diaries } = await supabase
        .from("diaries")
        .select("client_name, comments")
        .eq("facility_id", facilityId)
        .eq("staff_name", staffName)
        .gte("recorded_at", `${todayISO}T00:00:00.000Z`)
        .lte("recorded_at", `${todayISO}T23:59:59.999Z`);

      const enteredSet = new Set(
        (diaries ?? [])
          .filter((d) => (d.comments as Record<string, string>)?.role === role)
          .map((d) => d.client_name)
      );

      setEntries((prev) => prev.map((e) => ({ ...e, alreadyEntered: enteredSet.has(e.name) })));
    };

    check();
  }, [role, staffName, todayISO]);

  const updateComment = (name: string, comment: string) => {
    setEntries((prev) => prev.map((e) => e.name === name ? { ...e, comment } : e));
  };

  const addTemplate = (name: string, text: string) => {
    setEntries((prev) => prev.map((e) => {
      if (e.name !== name) return e;
      return { ...e, comment: e.comment ? e.comment + "。" + text : text };
    }));
  };

  const handleSave = async () => {
    if (!role || !staffName) return;
    setSaving(true);
    try {
      const result = await saveDiaryBatch(
        staffName,
        role as Role,
        entries.map((e) => ({ clientName: e.name, comment: e.comment }))
      );
      if ("error" in result && result.error) {
        alert("保存に失敗しました: " + result.error);
      } else if ("count" in result) {
        setSavedCount(result.count ?? entries.length);
      }
    } finally {
      setSaving(false);
    }
  };

  const activeRole = role ? serviceFormat.roles.find((r) => r.id === role) : null;
  const templates = activeRole?.templates;

  if (savedCount !== null) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-5">
          <CheckCircle2 size={40} className="text-blue-900" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-1">一括保存完了</h2>
        <p className="text-sm text-slate-500 mb-1">
          {staffName}（{activeRole?.label}）として保存しました
        </p>
        <span className="text-xs font-bold bg-blue-100 text-blue-900 px-3 py-1 rounded-full mb-8">
          {savedCount}名分の日報を保存しました
        </span>
        <div className="w-full max-w-xs space-y-3">
          <button
            onClick={() => setSavedCount(null)}
            className="w-full py-3.5 bg-blue-900 text-white rounded-2xl font-bold text-sm"
          >
            続けて入力する
          </button>
          <Link
            href="/diary"
            className="block w-full py-3.5 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm text-center"
          >
            ウィザード入力に戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 pt-5 pb-32 md:max-w-lg md:mx-auto">
      {/* ヘッダー */}
      <div className="mb-5 flex items-center gap-3">
        <Link href="/diary" className="text-slate-400 hover:text-slate-600 transition-colors">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <ClipboardList size={16} className="text-blue-900" />
            日報一括入力
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">{today}</p>
        </div>
      </div>

      {/* Step 1: 役職 */}
      <div className="mb-4">
        <p className="text-xs font-bold text-slate-400 mb-2">役職を選択</p>
        <div className="flex gap-2">
          {serviceFormat.roles.map((r, i) => {
            const isSelected = role === r.id;
            const colors = i === 0
              ? { bg: "bg-blue-50", border: "border-blue-900", text: "text-blue-900" }
              : { bg: "bg-blue-50", border: "border-blue-900", text: "text-blue-900" };
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => { setRole(r.id as Role); setStaffName(""); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl border-2 text-sm font-bold transition-all active:scale-[0.98] ${
                  isSelected ? `${colors.bg} ${colors.border} ${colors.text}` : "bg-white border-slate-100 text-slate-600"
                }`}
              >
                {isSelected && <CheckCircle2 size={13} />}
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2: 記録者 */}
      {role && (
        <div className="mb-5">
          <p className="text-xs font-bold text-slate-400 mb-2">記録者を選択</p>
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 size={20} className="animate-spin text-slate-300" />
            </div>
          ) : staffByRole[role as Role].length === 0 ? (
            <p className="text-sm text-slate-400 py-2">
              指導員が登録されていません。設定から追加してください。
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {staffByRole[role as Role].map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setStaffName(name)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-[0.97] ${
                    staffName === name
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
      )}

      {/* 利用者カード一覧 */}
      {role && staffName && (
        <>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={24} className="animate-spin text-slate-300" />
            </div>
          ) : entries.length === 0 ? (
            <p className="text-center py-12 text-slate-400 text-sm">
              利用者が登録されていません。管理者に追加を依頼してください。
            </p>
          ) : (
            <div className="space-y-4">
              {entries.map((entry) => {
                const isAbsent = entry.attendance === "●";
                return (
                  <div
                    key={entry.name}
                    className={`rounded-2xl border p-4 transition-all ${
                      isAbsent ? "bg-slate-50 border-slate-100" : "bg-white border-slate-200"
                    }`}
                  >
                    {/* カードヘッダー */}
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-slate-800">{entry.name}</h3>
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {entry.attendance && (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            isAbsent ? "bg-red-100 text-red-600" :
                            entry.attendance === "△" ? "bg-slate-100 text-slate-600" :
                            "bg-blue-100 text-blue-900"
                          }`}>
                            {isAbsent ? "● 欠席" : entry.attendance === "△" ? "△ 遅刻" : "○ 出席"}
                            <span className="text-[10px] ml-1 opacity-70">管理者入力済み</span>
                          </span>
                        )}
                        {entry.alreadyEntered && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-900">
                            入力済み
                          </span>
                        )}
                      </div>
                    </div>

                    {isAbsent ? (
                      <p className="text-xs text-slate-400">欠席のため評価不要</p>
                    ) : (
                      <>
                        {templates && (
                          <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-0.5 px-0.5 scrollbar-none mb-2">
                            {templates.positive.map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => addTemplate(entry.name, t)}
                                className="shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 border border-blue-200 text-blue-900 whitespace-nowrap active:scale-95"
                              >
                                {t}
                              </button>
                            ))}
                            {templates.neutral.map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => addTemplate(entry.name, t)}
                                className="shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 border border-blue-200 text-blue-900 whitespace-nowrap active:scale-95"
                              >
                                {t}
                              </button>
                            ))}
                            {templates.concern.map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => addTemplate(entry.name, t)}
                                className="shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-700 whitespace-nowrap active:scale-95"
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        )}
                        <input
                          type="text"
                          value={entry.comment}
                          onChange={(e) => updateComment(entry.name, e.target.value)}
                          placeholder="一言コメント（定型文をタップで追記）"
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-300"
                        />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* 一括保存ボタン（固定） */}
      {role && staffName && entries.length > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 px-4 pt-4 bg-white border-t border-slate-200 shadow-lg"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 1rem)" }}
        >
          <div className="w-full md:max-w-lg md:mx-auto">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-sm transition-all ${
                saving
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                  : "bg-blue-900 text-white shadow-md active:scale-[0.98]"
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
                  全員分を一括保存（{entries.length}名分）
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* role/staff 未選択時のガイド */}
      {(!role || !staffName) && !loading && (
        <div className="mt-4 flex flex-col items-center gap-2 py-12 text-center">
          <Users size={36} className="text-slate-200" />
          <p className="text-sm text-slate-400">役職と記録者を選択すると<br />利用者一覧が表示されます</p>
        </div>
      )}
    </div>
  );
}
