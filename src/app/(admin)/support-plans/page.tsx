"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ClipboardList, Loader2, Plus, Pencil, Trash2, Download, History } from "lucide-react";
import { listSupportPlans, deleteSupportPlan } from "@/app/actions/support-plans";

type Plan = {
  id: string;
  client_name: string;
  plan_version: number;
  plan_start_date: string;
  plan_end_date: string;
  author_name: string | null;
  service_manager_name: string | null;
  created_at: string;
};

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
}

export default function SupportPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await listSupportPlans();
    setPlans(data as Plan[]);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleDelete = async (p: Plan) => {
    if (!confirm(`「${p.client_name}」の計画書 v${p.plan_version} を削除します。よろしいですか？`)) return;
    const res = await deleteSupportPlan(p.id);
    if (res.error) {
      alert("削除に失敗: " + res.error);
      return;
    }
    refresh();
  };

  const filtered = filter.trim()
    ? plans.filter((p) => p.client_name.includes(filter.trim()))
    : plans;

  // 利用者ごとにグルーピング
  const grouped = filtered.reduce<Record<string, Plan[]>>((acc, p) => {
    (acc[p.client_name] ??= []).push(p);
    return acc;
  }, {});

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto pb-20">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <ClipboardList size={18} className="text-blue-900" />
          個別支援計画書 管理
        </h1>
        <Link
          href="/documents/generate?type=support_plan"
          className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-bold bg-blue-900 text-white hover:bg-blue-950"
        >
          <Plus size={14} />
          新規作成
        </Link>
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="利用者名で絞り込み"
          className="w-full max-w-xs px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin text-slate-300" />
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <p className="text-sm text-slate-500">個別支援計画書はまだ作成されていません。</p>
          <Link
            href="/documents/generate?type=support_plan"
            className="mt-4 inline-flex items-center gap-1 text-blue-900 text-sm font-semibold hover:underline"
          >
            <Plus size={13} />
            最初の計画書を作成する
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([clientName, group]) => (
            <section key={clientName} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <header className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                <p className="font-bold text-slate-900 text-sm">{clientName}</p>
                <p className="text-xs text-slate-500">{group.length} 件</p>
              </header>
              <ul className="divide-y divide-slate-100">
                {group.map((p) => (
                  <li key={p.id} className="px-5 py-3 flex items-center gap-3 flex-wrap">
                    <span className="text-xs font-bold text-blue-900 bg-slate-100 px-2 py-0.5 rounded-full">
                      v{p.plan_version}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-800">
                        {formatDate(p.plan_start_date)} 〜 {formatDate(p.plan_end_date)}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        作成者: {p.author_name ?? "—"} / 管理責任者: {p.service_manager_name ?? "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/documents/generate?type=support_plan&planId=${p.id}`}
                        className="flex items-center gap-1 text-xs font-semibold text-blue-900 hover:underline"
                      >
                        <Pencil size={12} />
                        編集
                      </Link>
                      <a
                        href={`/api/export/support-plan?id=${p.id}`}
                        className="flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-blue-900"
                      >
                        <Download size={12} />
                        Excel
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDelete(p)}
                        className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-red-700"
                      >
                        <Trash2 size={12} />
                        削除
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <div className="mt-8 text-xs text-slate-500 flex items-center gap-1.5">
        <History size={12} />
        最新版は plan_version の最大値。半年ごとに新規作成し、過去版は履歴として残ります。
      </div>
    </div>
  );
}
