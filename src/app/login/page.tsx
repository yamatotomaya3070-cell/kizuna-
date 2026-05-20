"use client";

import { useState, useTransition } from "react";
import {
  ShieldCheck,
  Building2,
  Users,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
} from "lucide-react";
import { loginUser } from "@/app/actions/auth";

type FacilityRoleTab = "facility_admin" | "facility";

const TAB_LABEL: Record<FacilityRoleTab, { label: string; hint: string }> = {
  facility_admin: {
    label: "事業所長",
    hint: "事業所の管理者（事業所長 / サービス管理責任者）の方はこちら",
  },
  facility: {
    label: "施設スタッフ",
    hint: "日々の日報入力を行う現場スタッフの方はこちら",
  },
};

export default function LoginPage() {
  const [tab, setTab] = useState<FacilityRoleTab>("facility_admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("メールアドレスとパスワードを入力してください。");
      return;
    }
    const formData = new FormData();
    formData.set("email", email);
    formData.set("password", password);
    startTransition(async () => {
      const result = await loginUser(formData);
      if (result?.error) setError(result.error);
    });
  };

  return (
    <div className="min-h-full flex">
      {/* 左パネル */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-800 flex-col justify-between p-12">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 bg-blue-900 rounded-xl flex items-center justify-center">
              <ShieldCheck size={20} className="text-white" />
            </div>
            <span className="text-white font-bold text-lg">福祉運営指導サポート</span>
          </div>
          <p className="text-slate-400 text-xs">合同会社絆</p>
        </div>

        <div>
          <h2 className="text-white text-3xl font-bold leading-snug mb-4">
            毎日の記録を、<br />監査につよい証拠に。
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            日報・出欠・支援計画・モニタリング——<br />
            すべての記録を一元化し、運営指導に備えます。
          </p>
        </div>

        <ul className="space-y-3">
          {[
            "スマホから3分で日報入力",
            "AIが日報からモニタリング評価を生成",
            "個別支援計画のExcel自動生成",
            "監査対応の書類自動出力",
          ].map((f) => (
            <li key={f} className="flex items-center gap-2 text-slate-300 text-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
              {f}
            </li>
          ))}
        </ul>
      </div>

      {/* 右パネル */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-blue-900 rounded-lg flex items-center justify-center">
              <ShieldCheck size={16} className="text-white" />
            </div>
            <span className="font-bold text-slate-800">福祉運営指導サポート</span>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-slate-800">ログイン</h1>
            <p className="text-sm text-slate-500 mt-1">アカウント種別を選択してサインインしてください</p>
          </div>

          {/* ロール切り替えタブ（事業所長 / 施設スタッフ） */}
          <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
            {(["facility_admin", "facility"] as FacilityRoleTab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setTab(t); setError(""); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  tab === t ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {t === "facility_admin" ? <Building2 size={15} /> : <Users size={15} />}
                {TAB_LABEL[t].label}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500 -mt-2">{TAB_LABEL[tab].hint}</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700">
                メールアドレス
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
                パスワード
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pr-11 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm">
                <AlertCircle size={15} className="shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold text-white transition-all ${
                isPending
                  ? "bg-blue-400 cursor-wait"
                  : "bg-blue-900 hover:bg-blue-900 active:scale-[0.98] shadow-md hover:shadow-lg"
              }`}
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ログイン中...
                </span>
              ) : (
                <><LogIn size={16} />ログイン</>
              )}
            </button>
          </form>

          <p className="text-xs text-slate-400 text-center">
            アカウントの発行は、契約事業所の管理者または合同会社絆までお問い合わせください。
          </p>
        </div>
      </div>
    </div>
  );
}
