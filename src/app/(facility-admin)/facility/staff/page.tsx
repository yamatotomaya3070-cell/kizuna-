"use client";

import { useEffect, useState, useCallback } from "react";
import {
  UserPlus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Trash2,
  Users,
} from "lucide-react";

type Staff = {
  id: string;
  email: string;
  created_at: string;
};

export default function FacilityStaffPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [staff, setStaff] = useState<Staff[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await fetch("/api/facility-staff");
      const json = await res.json();
      if (res.ok) setStaff(json.staff ?? []);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!email || !password) {
      setMessage({ type: "err", text: "メールアドレスとパスワードを入力してください。" });
      return;
    }
    if (password.length < 8) {
      setMessage({ type: "err", text: "パスワードは8文字以上にしてください。" });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/create-facility-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "作成に失敗しました");
      setMessage({ type: "ok", text: `${email} を作成しました。スタッフ本人にメール・パスワードを連絡してください。` });
      setEmail("");
      setPassword("");
      refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "作成に失敗しました";
      setMessage({ type: "err", text: msg });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (s: Staff) => {
    if (!confirm(`${s.email} を削除します。よろしいですか？\n（過去の日報など蓄積データは残ります）`)) return;
    setDeletingId(s.id);
    try {
      const res = await fetch(`/api/facility-staff/${s.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "削除に失敗しました");
      setStaff((cur) => cur.filter((x) => x.id !== s.id));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "削除に失敗しました";
      alert(msg);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">施設スタッフ管理</h2>
        <p className="text-sm text-slate-500 mt-1">自事業所に所属するスタッフのアカウントを発行・管理します</p>
      </div>

      {/* 追加フォーム */}
      <div className="bg-white rounded-2xl shadow-sm p-6 max-w-xl">
        <div className="flex items-center gap-2 mb-4">
          <UserPlus size={18} className="text-blue-900" />
          <h3 className="font-bold text-slate-800">スタッフを追加</h3>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">メールアドレス</label>
            <input
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="staff@example.com"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">初期パスワード（8文字以上）</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 pr-11 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
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
            <p className="text-xs text-slate-400">スタッフ本人が初回ログイン後にパスワード変更することを推奨します。</p>
          </div>

          {message && (
            <div className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${
              message.type === "ok"
                ? "text-emerald-700 bg-emerald-50 border border-emerald-200"
                : "text-red-600 bg-red-50 border border-red-200"
            }`}>
              {message.type === "ok" ? <CheckCircle2 size={15} className="shrink-0 mt-0.5" /> : <AlertCircle size={15} className="shrink-0 mt-0.5" />}
              <span>{message.text}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={creating}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all ${
              creating ? "bg-blue-400 cursor-wait" : "bg-blue-900 hover:bg-blue-900 active:scale-[0.98] shadow-md"
            }`}
          >
            {creating ? <><Loader2 size={16} className="animate-spin" />作成中...</> : <><UserPlus size={16} />スタッフアカウントを作成</>}
          </button>
        </form>
      </div>

      {/* スタッフ一覧 */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100">
          <Users size={18} className="text-blue-900" />
          <h3 className="font-bold text-slate-800">スタッフ一覧</h3>
          <span className="text-xs text-slate-400">（{staff.length}名）</span>
        </div>

        {listLoading ? (
          <div className="py-12 flex justify-center">
            <Loader2 size={24} className="animate-spin text-slate-300" />
          </div>
        ) : staff.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            <Users size={28} className="mx-auto mb-2 text-slate-200" />
            まだスタッフが登録されていません
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-6 py-3 text-left">メールアドレス</th>
                <th className="px-6 py-3 text-left">登録日</th>
                <th className="px-6 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staff.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-slate-800 font-medium">{s.email}</td>
                  <td className="px-6 py-4 text-slate-500 text-xs">
                    {new Date(s.created_at).toLocaleDateString("ja-JP")}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDelete(s)}
                      disabled={deletingId === s.id}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
                    >
                      {deletingId === s.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 max-w-xl text-xs text-slate-600 leading-relaxed">
        <p className="font-bold text-blue-900 mb-1">注意事項</p>
        <ul className="space-y-1 list-disc pl-4">
          <li>ここで作成されるアカウントは「施設スタッフ」権限です。本部管理機能や他事業所のデータにはアクセスできません。</li>
          <li>所属事業所はあなたの事業所に自動で紐付きます。</li>
          <li>削除されたスタッフがこれまで入力した日報・記録は残ります（監査証拠として保全）。</li>
        </ul>
      </div>
    </div>
  );
}
