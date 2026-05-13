"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { SERVICE_TYPE_LABELS, type ServiceType } from "@/data/service-formats";
import {
  Building2,
  UserPlus,
  Loader2,
  CheckCircle2,
  Eye,
  EyeOff,
} from "lucide-react";

type Facility = {
  id: string;
  name: string;
  service_type: ServiceType;
  created_at: string;
};

export default function FacilitiesPage() {
  const supabase = createClient();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState<"ok" | "err">("ok");

  // フォーム
  const [facilityName, setFacilityName] = useState("");
  const [serviceType, setServiceType] = useState<ServiceType>("b_type");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [adding, setAdding] = useState(false);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast(msg); setToastType(type);
    setTimeout(() => setToast(""), 4000);
  };

  const fetchFacilities = async () => {
    const { data } = await supabase
      .from("facilities")
      .select("id, name, service_type, created_at")
      .order("created_at", { ascending: false });
    setFacilities(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchFacilities(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const handleAdd = async () => {
    if (!facilityName.trim() || !email.trim() || !password.trim()) return;
    if (password.length < 8) { showToast("パスワードは8文字以上にしてください", "err"); return; }
    setAdding(true);
    try {
      const res = await fetch("/api/create-facility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facilityName: facilityName.trim(), serviceType, email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFacilityName(""); setServiceType("b_type"); setEmail(""); setPassword("");
      showToast(`「${facilityName}」を追加しました`);
      await fetchFacilities();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "追加に失敗しました";
      showToast(msg, "err");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="p-8 space-y-8 relative">
      {/* トースト */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 text-white text-sm font-semibold px-4 py-3 rounded-xl shadow-lg ${toastType === "ok" ? "bg-slate-800" : "bg-red-600"}`}>
          <CheckCircle2 size={16} className={toastType === "ok" ? "text-blue-400" : "text-white"} />
          {toast}
        </div>
      )}

      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <Building2 size={22} className="text-blue-900" />
        <div>
          <h2 className="text-2xl font-bold text-slate-800">事業所管理</h2>
          <p className="text-sm text-slate-500 mt-0.5">新規事業所の追加とアカウント発行を行います</p>
        </div>
      </div>

      {/* 追加フォーム */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-700">新規事業所を追加</h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">事業所名</label>
            <input
              type="text"
              value={facilityName}
              onChange={(e) => setFacilityName(e.target.value)}
              placeholder="例：さくら福祉センター"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">事業種別</label>
            <select
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value as ServiceType)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              {(Object.entries(SERVICE_TYPE_LABELS) as [ServiceType, string][]).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">ログイン用メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="facility@example.com"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">初期パスワード（8文字以上）</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 pr-10 rounded-xl border border-slate-200 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleAdd}
            disabled={adding || !facilityName.trim() || !email.trim() || !password.trim()}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all ${
              adding || !facilityName.trim() || !email.trim() || !password.trim()
                ? "bg-slate-300 cursor-not-allowed"
                : "bg-blue-900 hover:bg-blue-900"
            }`}
          >
            {adding ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
            事業所を追加してアカウント発行
          </button>
        </div>
      </div>

      {/* 事業所一覧 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-700">登録済み事業所</h3>
          <span className="text-xs text-slate-400">{facilities.length}件</span>
        </div>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={24} className="animate-spin text-slate-300" />
          </div>
        ) : facilities.length === 0 ? (
          <p className="text-center py-12 text-slate-400 text-sm">事業所が登録されていません</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {facilities.map((f) => (
              <li key={f.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                  <Building2 size={16} className="text-blue-900" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{f.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {SERVICE_TYPE_LABELS[f.service_type] ?? f.service_type} ・ 登録日: {new Date(f.created_at).toLocaleDateString("ja-JP")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
