"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Sparkles, Building2, Crown } from "lucide-react";

const PLANS = [
  {
    id: "light",
    name: "ライト",
    price: "¥5,000",
    icon: Building2,
    color: "slate",
    features: ["運営指導チェックリスト", "書類保管庫", "基本通知"],
  },
  {
    id: "standard",
    name: "スタンダード",
    price: "¥12,000",
    icon: Sparkles,
    color: "blue",
    recommended: true,
    features: ["ライトの全機能", "AIモニタリング評価", "日報入力アプリ", "PDF出力"],
  },
  {
    id: "premium",
    name: "プレミアム",
    price: "¥20,000",
    icon: Crown,
    color: "indigo",
    features: ["スタンダードの全機能", "LINE通知", "優先サポート", "監査対策レポート"],
  },
];

export default function BillingPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("canceled") === "1") {
      setMessage("決済がキャンセルされました。必要な場合はもう一度プランを選択してください。");
    }
  }, []);

  const handleCheckout = async (planId: string) => {
    setLoading(planId);
    setMessage("");
    try {
      const res = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId, facilityName: "テスト施設" }),
      });
      const { url, error } = await res.json();
      if (!res.ok || error) throw new Error(error ?? "決済セッションの作成に失敗しました");
      if (!url) throw new Error("Checkout URLを取得できませんでした");
      window.location.href = url;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "現在、課金機能は準備中です。デモ環境のため、実際の決済は行われません。");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-slate-800">プランを選択</h1>
        <p className="text-sm text-slate-500 mt-2">
          全プラン初月無料・クレジットカード不要でお試しいただけます
        </p>
      </div>

      {message && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {PLANS.map((plan) => {
          const Icon = plan.icon;
          return (
            <div
              key={plan.id}
              className={`relative bg-white rounded-3xl border-2 p-6 flex flex-col ${
                plan.recommended
                  ? "border-blue-900 shadow-lg shadow-blue-100"
                  : "border-slate-200"
              }`}
            >
              {plan.recommended && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-900 text-white text-xs font-bold px-4 py-1 rounded-full">
                  おすすめ
                </span>
              )}

              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${
                plan.color === "blue" ? "bg-blue-100" :
                plan.color === "indigo" ? "bg-blue-100" : "bg-slate-100"
              }`}>
                <Icon size={22} className={
                  plan.color === "blue" ? "text-blue-900" :
                  plan.color === "indigo" ? "text-blue-900" : "text-slate-600"
                } />
              </div>

              <h2 className="text-lg font-bold text-slate-800">{plan.name}</h2>
              <p className="text-3xl font-bold text-slate-900 mt-1 mb-1">{plan.price}</p>
              <p className="text-xs text-slate-400 mb-5">/ 月（税抜）</p>

              <ul className="space-y-2.5 flex-1 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-700">
                    <CheckCircle2 size={15} className="text-blue-900 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleCheckout(plan.id)}
                disabled={loading === plan.id}
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
                  plan.recommended
                    ? "bg-blue-900 text-white hover:bg-blue-900"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                } ${loading === plan.id ? "opacity-50 cursor-wait" : ""}`}
              >
                {loading === plan.id ? "処理中..." : "このプランを選ぶ"}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-slate-400 mt-8">
        本番環境では決済はStripeで安全に処理されます。デモ環境では実際の決済は行われません。
      </p>
    </div>
  );
}
