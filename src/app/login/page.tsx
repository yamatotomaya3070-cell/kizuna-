"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Building2,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Role = "admin" | "facility";

const DEMO_ACCOUNTS: Record<Role, { email: string; password: string; label: string }> = {
  admin: {
    email: "admin@kizuna.co.jp",
    password: "admin1234",
    label: "運営会社（管理者）",
  },
  facility: {
    email: "sakura@example.com",
    password: "facility1234",
    label: "事業所（施設スタッフ）",
  },
};

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [role, setRole] = useState<Role>("facility");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const demo = DEMO_ACCOUNTS[role];

  const fillDemo = () => {
    setEmail(demo.email);
    setPassword(demo.password);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("メールアドレスとパスワードを入力してください。");
      return;
    }

    setLoading(true);

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError("メールアドレスまたはパスワードが正しくありません。");
      setLoading(false);
      return;
    }

    const userRole = data.user?.user_metadata?.role ?? "facility";
    router.push(userRole === "admin" ? "/admin" : "/");
    router.refresh();
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
            運営指導対策を、<br />もっとかんたんに。
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            書類管理・チェックリスト・AIモニタリング評価——<br />
            障がい福祉事業所の実地指導対策をワンストップでサポートします。
          </p>
        </div>

        <ul className="space-y-3">
          {[
            "運営指導チェックリスト（別紙1・2）",
            "必須マニュアル5点の雛形管理",
            "AI日報→モニタリング評価の自動生成",
            "LINE通知・期限アラート",
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
        <div className="w-full max-w-md space-y-8">
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

          {/* ロール切り替え */}
          <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
            {(["facility", "admin"] as Role[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => { setRole(r); setEmail(""); setPassword(""); setError(""); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  role === r ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {r === "facility" ? <Building2 size={15} /> : <ShieldCheck size={15} />}
                {r === "facility" ? "事業所" : "運営管理者"}
              </button>
            ))}
          </div>

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
                placeholder={demo.email}
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
              disabled={loading}
              className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold text-white transition-all ${
                loading
                  ? "bg-blue-400 cursor-wait"
                  : "bg-blue-900 hover:bg-blue-900 active:scale-[0.98] shadow-md hover:shadow-lg"
              }`}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ログイン中...
                </span>
              ) : (
                <><LogIn size={16} />ログイン</>
              )}
            </button>
          </form>

          {/* デモ用 */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">
              デモ用アカウント — {demo.label}
            </p>
            <div className="space-y-1.5 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span className="w-20 text-slate-400 shrink-0">メール</span>
                <code className="bg-white border border-slate-200 px-2 py-0.5 rounded-md font-mono text-slate-700">{demo.email}</code>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-20 text-slate-400 shrink-0">パスワード</span>
                <code className="bg-white border border-slate-200 px-2 py-0.5 rounded-md font-mono text-slate-700">{demo.password}</code>
              </div>
            </div>
            <button
              type="button"
              onClick={fillDemo}
              className="mt-3 w-full text-xs font-semibold text-blue-900 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg py-2 transition-colors"
            >
              上記を自動入力
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
