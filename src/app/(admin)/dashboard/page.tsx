"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  CheckCircle2,
  Circle,
  Plus,
  Loader2,
  Trash2,
  X,
  PartyPopper,
} from "lucide-react";

type Task = {
  id: string;
  title: string;
  category: string;
  due_date: string | null;
  completed: boolean;
};

function daysLeft(dueDate: string | null): number | null {
  if (!dueDate) return null;
  return Math.round(
    (new Date(dueDate).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) /
      (1000 * 60 * 60 * 24)
  );
}

// ---- 円グラフ ----
function CircularProgress({ percent }: { percent: number }) {
  const r = 54, cx = 64, cy = 64;
  const circumference = 2 * Math.PI * r;
  const stroke = percent === 100 ? "#059669" : percent >= 70 ? "#2563eb" : percent >= 40 ? "#d97706" : "#dc2626";
  return (
    <svg width="128" height="128" className="rotate-[-90deg]">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth="12" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={stroke} strokeWidth="12"
        strokeLinecap="round" strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - percent / 100)}
        className="transition-all duration-700" />
    </svg>
  );
}

// ---- 期限バッジ ----
function DaysBadge({ days }: { days: number | null }) {
  if (days === null) return <span className="text-xs text-slate-300">期限なし</span>;
  if (days < 0) return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">{Math.abs(days)}日超過</span>;
  if (days <= 7) return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">残{days}日</span>;
  return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">残{days}日</span>;
}

const CATEGORIES = ["書類整備", "運営管理", "記録管理", "人事・労務", "当日準備", "その他"];

export default function ClientDashboardPage() {
  const supabase = createClient();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [facilityId, setFacilityId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 追加フォーム
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("その他");
  const [newDueDate, setNewDueDate] = useState("");
  const [noDueDate, setNoDueDate] = useState(false);
  const [adding, setAdding] = useState(false);

  const fetchTasks = useCallback(async (fid: string) => {
    const { data } = await supabase
      .from("tasks")
      .select("id, title, category, due_date, completed")
      .eq("facility_id", fid)
      .order("due_date", { ascending: true, nullsFirst: false });
    setTasks((data as Task[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("facility_id").eq("id", user.id).single();
      const fid = profile?.facility_id;
      setFacilityId(fid);
      await fetchTasks(fid);
    };
    init();
  }, [fetchTasks, supabase]);

  const handleToggle = async (task: Task) => {
    setTogglingId(task.id);
    await supabase.from("tasks").update({ completed: !task.completed }).eq("id", task.id);
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, completed: !t.completed } : t));
    setTogglingId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("このタスクを削除しますか？")) return;
    setDeletingId(id);
    await supabase.from("tasks").delete().eq("id", id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setDeletingId(null);
  };

  const handleAdd = async () => {
    if (!newTitle.trim() || !facilityId) return;
    if (!newDueDate && !noDueDate) return;
    setAdding(true);
    const { data } = await supabase.from("tasks").insert({
      title: newTitle.trim(),
      category: newCategory,
      due_date: newDueDate || null,
      facility_id: facilityId,
    }).select().single();
    if (data) setTasks((prev) => [...prev, data as Task].sort((a, b) => {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    }));
    setNewTitle(""); setNewDueDate(""); setNewCategory("その他");
    setNoDueDate(false);
    setShowForm(false);
    setAdding(false);
  };

  const completedCount = tasks.filter((t) => t.completed).length;
  const totalCount = tasks.length;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const upcomingTasks = tasks.filter((t) => !t.completed);
  const completeAll = totalCount > 0 && upcomingTasks.length === 0;
  const progressColor = completeAll
    ? "bg-blue-900"
    : completionRate >= 70
    ? "bg-blue-900"
    : completionRate >= 40
    ? "bg-slate-500"
    : "bg-red-500";

  return (
    <div className="p-8 space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">施設管理ダッシュボード</h2>
        <p className="text-sm text-slate-500 mt-1">運営指導対応の進捗と最新通知を確認できます</p>
      </div>

      {/* 完了率 */}
      <section className={`rounded-xl border p-6 shadow-sm ${
        completeAll ? "border-blue-200 bg-blue-50" : "border-transparent bg-white"
      }`}>
        <div className="mb-6 flex items-center justify-between gap-4">
          <h3 className="font-semibold text-slate-700">タスク完了率</h3>
          {completeAll && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-900 px-3 py-1 text-xs font-bold text-white">
              <PartyPopper size={13} />
              全タスク完了！
            </span>
          )}
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-8">
          <div className="relative flex-shrink-0">
            <CircularProgress percent={completionRate} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {completeAll && <CheckCircle2 size={18} className="mb-1 text-blue-900" />}
              <span className={`text-3xl font-bold ${completeAll ? "text-blue-900" : "text-slate-800"}`}>{completionRate}%</span>
              <span className="text-xs text-slate-500 mt-0.5">{completeAll ? "達成" : "完了"}</span>
            </div>
          </div>
          <div className="flex-1 space-y-4 w-full">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">完了タスク</span>
              <span className="font-bold text-blue-900">{completedCount} 件</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">未完了タスク</span>
              <span className="font-bold text-slate-500">{totalCount - completedCount} 件</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">総タスク数</span>
              <span className="font-bold text-slate-700">{totalCount} 件</span>
            </div>
            <div className="pt-2 space-y-2">
              <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden">
                <div
                  className={`${progressColor} h-4 rounded-full transition-all duration-700`}
                  style={{ width: `${completionRate}%` }}
                />
              </div>
              <p className={`text-xs font-semibold ${completeAll ? "text-blue-900" : "text-slate-500"}`}>
                {completeAll ? "すべての対応が完了しています" : `残り ${totalCount - completedCount} 件です`}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* タスク一覧 */}
      <section className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-700">タスク一覧</h3>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-900 text-white hover:bg-blue-900 transition-colors"
          >
            <Plus size={13} />
            タスクを追加
          </button>
        </div>

        {/* 追加フォーム */}
        {showForm && (
          <div className="px-6 py-4 bg-blue-50 border-b border-blue-100 space-y-3">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="タスク名を入力"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <div className="flex gap-3 flex-wrap">
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                disabled={noDueDate}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-slate-100 disabled:text-slate-400"
              />
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
                <input
                  type="checkbox"
                  checked={noDueDate}
                  onChange={(e) => {
                    setNoDueDate(e.target.checked);
                    if (e.target.checked) setNewDueDate("");
                  }}
                  className="h-4 w-4 rounded border-slate-300"
                />
                期限なし
              </label>
              <div className="flex gap-2 ml-auto">
                <button onClick={() => setShowForm(false)} className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-colors">
                  <X size={14} />
                </button>
                <button
                  onClick={handleAdd}
                  disabled={adding || !newTitle.trim() || (!newDueDate && !noDueDate)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-900 text-white hover:bg-blue-900 disabled:bg-slate-300 transition-colors"
                >
                  {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  追加
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={24} className="animate-spin text-slate-300" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">
            タスクがありません。「タスクを追加」から登録してください。
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {tasks.map((task) => {
              const days = daysLeft(task.due_date);
              return (
                <li key={task.id} className={`px-6 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors ${task.completed ? "opacity-50" : ""}`}>
                  <button
                    onClick={() => handleToggle(task)}
                    disabled={togglingId === task.id}
                    className="shrink-0 text-slate-400 hover:text-blue-900 transition-colors"
                  >
                    {togglingId === task.id
                      ? <Loader2 size={20} className="animate-spin" />
                      : task.completed
                      ? <CheckCircle2 size={20} className="text-blue-900" />
                      : <Circle size={20} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${task.completed ? "line-through text-slate-400" : "text-slate-800"}`}>
                      {task.title}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {task.category}{task.due_date ? ` · 期限 ${task.due_date}` : ""}
                    </p>
                  </div>
                  <DaysBadge days={days} />
                  <button
                    onClick={() => handleDelete(task.id)}
                    disabled={deletingId === task.id}
                    className="shrink-0 text-slate-200 hover:text-red-400 transition-colors ml-2"
                  >
                    {deletingId === task.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {!loading && tasks.length > 0 && upcomingTasks.length === 0 && (
          <div className="bg-blue-50 border-t border-blue-100 p-4 text-center">
            <p className="inline-flex items-center justify-center gap-2 text-blue-900 font-bold text-sm">
              <PartyPopper size={16} />
              全タスク完了！
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
