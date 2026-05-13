"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Bell,
  Loader2,
  RefreshCw,
  Briefcase,
  Heart,
} from "lucide-react";

type RoleStatus = {
  lastEntry: string | null;
  daysAgo: number | null;
};

type ClientStatus = {
  name: string;
  work: RoleStatus;
  life: RoleStatus;
};

function statusLevel(daysAgo: number | null): "ok" | "warn" | "danger" | "none" {
  if (daysAgo === null) return "none";
  if (daysAgo <= 1) return "ok";
  if (daysAgo <= 3) return "warn";
  return "danger";
}

const STATUS_STYLE = {
  ok:     { badge: "bg-blue-100 text-blue-900", icon: <CheckCircle2 size={11} /> },
  warn:   { badge: "bg-slate-100 text-slate-700",   icon: <AlertTriangle size={11} /> },
  danger: { badge: "bg-red-100 text-red-700",          icon: <AlertCircle size={11} /> },
  none:   { badge: "bg-slate-100 text-slate-500",      icon: <AlertCircle size={11} /> },
};

function RoleBadge({ role, status }: { role: "work" | "life"; status: RoleStatus }) {
  const level = statusLevel(status.daysAgo);
  const s = STATUS_STYLE[level];
  const label = role === "work" ? "職業" : "生活";
  const Icon = role === "work" ? Briefcase : Heart;
  const colorClass = role === "work" ? "text-blue-900" : "text-blue-900";

  return (
    <div className="flex flex-col items-center gap-1 min-w-[72px]">
      <span className={`flex items-center gap-1 text-xs font-semibold ${colorClass}`}>
        <Icon size={11} />
        {label}
      </span>
      <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${s.badge}`}>
        {s.icon}
        {status.daysAgo === null
          ? "なし"
          : status.daysAgo === 0
          ? "今日"
          : `${status.daysAgo}日前`}
      </span>
    </div>
  );
}

export default function StatusPage() {
  const supabase = createClient();
  const [statuses, setStatuses] = useState<ClientStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [facilityId, setFacilityId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [notifying, setNotifying] = useState(false);
  const [notified, setNotified] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchStatuses = useCallback(async (fid: string) => {
    setLoading(true);

    const [{ data: clients }, { data: diaries }] = await Promise.all([
      supabase.from("clients").select("name").eq("facility_id", fid).eq("status", "active").order("name"),
      supabase
        .from("diaries")
        .select("client_name, recorded_at, role, comments")
        .eq("facility_id", fid)
        .order("recorded_at", { ascending: false }),
    ]);

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    type LastMap = Record<string, { work: string | null; life: string | null }>;
    const lastEntryMap: LastMap = {};

    for (const d of diaries ?? []) {
      const name = d.client_name;
      if (!lastEntryMap[name]) lastEntryMap[name] = { work: null, life: null };
      // role カラムを優先。なければ comments.role にフォールバック
      const role: string =
        (d.role as string | null) ??
        (d.comments as Record<string, string> | null)?.role ??
        "work";

      if (role === "life" && !lastEntryMap[name].life) {
        lastEntryMap[name].life = d.recorded_at;
      } else if (role !== "life" && !lastEntryMap[name].work) {
        lastEntryMap[name].work = d.recorded_at;
      }
    }

    const calcDays = (ts: string | null): number | null => {
      if (!ts) return null;
      const d = new Date(ts);
      d.setHours(0, 0, 0, 0);
      return Math.round((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    };

    const result: ClientStatus[] = (clients ?? []).map((c) => {
      const m = lastEntryMap[c.name] ?? { work: null, life: null };
      return {
        name: c.name,
        work: { lastEntry: m.work, daysAgo: calcDays(m.work) },
        life: { lastEntry: m.life, daysAgo: calcDays(m.life) },
      };
    });

    const worstDays = (s: ClientStatus) =>
      Math.max(s.work.daysAgo ?? 999, s.life.daysAgo ?? 999);
    result.sort((a, b) => worstDays(b) - worstDays(a));

    setStatuses(result);
    setLastRefresh(new Date());
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserEmail(user.email ?? "");
      const { data: profile } = await supabase
        .from("profiles").select("facility_id").eq("id", user.id).single();
      const fid = profile?.facility_id;
      setFacilityId(fid);
      await fetchStatuses(fid);
    };
    init();
  }, [fetchStatuses, supabase]);

  const handleNotify = async () => {
    const unrecorded = statuses.filter(
      (s) =>
        (s.work.daysAgo === null || s.work.daysAgo >= 3) ||
        (s.life.daysAgo === null || s.life.daysAgo >= 3)
    );
    if (unrecorded.length === 0) return;

    setNotifying(true);
    const names = unrecorded.map((s) => {
      const wLabel = s.work.daysAgo === null ? "未記録" : `${s.work.daysAgo}日前`;
      const lLabel = s.life.daysAgo === null ? "未記録" : `${s.life.daysAgo}日前`;
      return `・${s.name}（職業:${wLabel} / 生活:${lLabel}）`;
    }).join("\n");

    const body = `以下の利用者の日報記録が滞っています。\n\n${names}\n\n早めにご記録ください。`;

    try {
      await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: userEmail,
          subject: "【要対応】日報の記録が滞っている利用者がいます",
          body,
        }),
      });
      setNotified(true);
      setTimeout(() => setNotified(false), 5000);
    } catch {
      alert("メール送信に失敗しました");
    } finally {
      setNotifying(false);
    }
  };

  const okCount = statuses.filter(
    (s) => statusLevel(s.work.daysAgo) === "ok" && statusLevel(s.life.daysAgo) === "ok"
  ).length;
  const warnCount = statuses.filter(
    (s) =>
      (statusLevel(s.work.daysAgo) === "warn" || statusLevel(s.life.daysAgo) === "warn") &&
      statusLevel(s.work.daysAgo) !== "danger" &&
      statusLevel(s.life.daysAgo) !== "danger"
  ).length;
  const dangerCount = statuses.filter(
    (s) =>
      statusLevel(s.work.daysAgo) === "danger" ||
      statusLevel(s.work.daysAgo) === "none" ||
      statusLevel(s.life.daysAgo) === "danger" ||
      statusLevel(s.life.daysAgo) === "none"
  ).length;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">入力状況モニター</h2>
          <p className="text-sm text-slate-500 mt-1">
            職業指導員・生活支援員それぞれの日報記録状況を確認できます
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-slate-400">
            最終更新: {lastRefresh.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
          </span>
          <button
            onClick={() => facilityId && fetchStatuses(facilityId)}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs text-slate-500 mb-1">両名記録済み</p>
          <p className="text-3xl font-bold text-blue-900">{okCount}</p>
          <p className="text-xs text-slate-400 mt-0.5">名</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs text-slate-500 mb-1">要確認（2〜3日）</p>
          <p className="text-3xl font-bold text-slate-500">{warnCount}</p>
          <p className="text-xs text-slate-400 mt-0.5">名</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs text-slate-500 mb-1">未記録（4日以上）</p>
          <p className="text-3xl font-bold text-red-500">{dangerCount}</p>
          <p className="text-xs text-slate-400 mt-0.5">名</p>
        </div>
      </div>

      {dangerCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-red-700">
              {dangerCount}名の利用者の記録が滞っています
            </p>
            <p className="text-xs text-red-500 mt-0.5">
              監査時に記録不足として指摘される可能性があります
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {notified && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-blue-900">
                <CheckCircle2 size={14} />
                メール送信済み
              </span>
            )}
            <button
              onClick={handleNotify}
              disabled={notifying || !userEmail}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:bg-slate-300 transition-colors"
            >
              {notifying ? <Loader2 size={15} className="animate-spin" /> : <Bell size={15} />}
              メールで通知する
            </button>
          </div>
        </div>
      )}

      {/* 利用者ステータス一覧 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-6">
          <h3 className="text-sm font-bold text-slate-700 flex-1">利用者別 記録状況</h3>
          <div className="flex gap-4 text-xs font-semibold text-slate-500">
            <span className="flex items-center gap-1"><Briefcase size={11} className="text-blue-900" />職業指導員</span>
            <span className="flex items-center gap-1"><Heart size={11} className="text-blue-900" />生活支援員</span>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={24} className="animate-spin text-slate-300" />
          </div>
        ) : statuses.length === 0 ? (
          <p className="text-center py-12 text-slate-400 text-sm">利用者が登録されていません</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {statuses.map((s) => {
              const lastDate = s.work.lastEntry
                ? new Date(s.work.lastEntry).toLocaleDateString("ja-JP", {
                    month: "numeric", day: "numeric",
                  })
                : null;
              return (
                <li key={s.name} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                  <div className="w-9 h-9 bg-blue-50 rounded-full flex items-center justify-center text-blue-900 text-sm font-bold shrink-0">
                    {s.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">{s.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {lastDate ? `職業最終: ${lastDate}` : "記録なし"}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <RoleBadge role="work" status={s.work} />
                    <RoleBadge role="life" status={s.life} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
