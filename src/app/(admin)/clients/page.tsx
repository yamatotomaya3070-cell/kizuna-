"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Edit3, Loader2, Trash2, UserPlus, Users, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type ClientStatus = "active" | "paused" | "left";

type Client = {
  id: string;
  name: string;
  facility_id: string;
  status: ClientStatus;
  notes: string;
  facilities?: { name?: string } | null;
};

const STATUS_LABEL: Record<ClientStatus, string> = {
  active: "利用中",
  paused: "休止中",
  left: "退所",
};

const EMPTY_FORM = {
  name: "",
  status: "active" as ClientStatus,
  notes: "",
};

export default function ClientsPage() {
  const supabase = createClient();
  const [clients, setClients] = useState<Client[]>([]);
  const [facilityId, setFacilityId] = useState("");
  const [facilityName, setFacilityName] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const fetchClients = async () => {
    const { data } = await supabase
      .from("clients")
      .select("id, name, facility_id, status, notes, facilities(name)")
      .order("name", { ascending: true });
    setClients((data as Client[] | null) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("facility_id, facilities(name)")
        .eq("id", user.id)
        .single();
      setFacilityId(profile?.facility_id ?? "");
      setFacilityName((profile?.facilities as { name?: string } | null)?.name ?? "所属事業所");
      await fetchClients();
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const handleSave = async () => {
    const name = form.name.trim();
    if (!name) {
      showToast("氏名を入力してください");
      return;
    }
    if (!facilityId && !editingId) {
      showToast("所属事業所が取得できません");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name,
        status: form.status,
        notes: form.notes.trim(),
      };
      const { error } = editingId
        ? await supabase.from("clients").update(payload).eq("id", editingId)
        : await supabase.from("clients").insert({ ...payload, facility_id: facilityId });
      if (error) throw error;

      showToast(editingId ? "利用者情報を更新しました" : "利用者を登録しました");
      resetForm();
      await fetchClients();
    } catch (e) {
      showToast(e instanceof Error ? `保存に失敗しました: ${e.message}` : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (client: Client) => {
    setEditingId(client.id);
    setForm({
      name: client.name,
      status: client.status ?? "active",
      notes: client.notes ?? "",
    });
  };

  const handleDelete = async (client: Client) => {
    if (!confirm(`「${client.name}」を削除しますか？`)) return;
    setDeletingId(client.id);
    try {
      const { error } = await supabase.from("clients").delete().eq("id", client.id);
      if (error) throw error;
      showToast("利用者を削除しました");
      setClients((prev) => prev.filter((c) => c.id !== client.id));
      if (editingId === client.id) resetForm();
    } catch (e) {
      showToast(e instanceof Error ? `削除に失敗しました: ${e.message}` : "削除に失敗しました");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="relative space-y-8 p-6 md:p-8">
      {toast && (
        <div className="fixed right-4 top-4 z-50 flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-3 text-sm font-semibold text-white shadow-lg">
          <CheckCircle2 size={16} className="text-emerald-400" />
          {toast}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Users size={22} className="text-blue-500" />
        <div>
          <h2 className="text-2xl font-bold text-slate-800">利用者管理</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            利用者マスタを登録・編集します。出欠入力や帳票生成は「利用中」の利用者を参照します。
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-700">
            {editingId ? "利用者を編集" : "利用者を新規登録"}
          </h3>
          {editingId && (
            <button
              onClick={resetForm}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100"
            >
              <X size={13} />
              編集を解除
            </button>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_220px_1fr_auto] lg:items-end">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">氏名</label>
            <input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="例：木村 太郎"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">所属事業所</label>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-600">
              {facilityName}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">備考</label>
            <input
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="必要に応じて記入"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
            className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
            {editingId ? "更新" : "登録"}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(["active", "paused", "left"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setForm((prev) => ({ ...prev, status }))}
              className={`rounded-xl px-3 py-2 text-xs font-bold transition-colors ${
                form.status === status
                  ? "bg-blue-600 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {STATUS_LABEL[status]}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-sm font-bold text-slate-700">登録済み利用者</h3>
          <span className="text-xs text-slate-400">{clients.length}名</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={24} className="animate-spin text-slate-300" />
          </div>
        ) : clients.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">
            利用者が登録されていません
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {clients.map((client) => (
              <li key={client.id} className="grid gap-3 px-5 py-4 transition-colors hover:bg-slate-50 md:grid-cols-[1fr_160px_1fr_auto] md:items-center">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-600">
                    {client.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{client.name}</p>
                    <p className="text-xs text-slate-400">{client.facilities?.name ?? facilityName}</p>
                  </div>
                </div>
                <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-bold ${
                  client.status === "active"
                    ? "bg-emerald-100 text-emerald-700"
                    : client.status === "paused"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-slate-100 text-slate-600"
                }`}>
                  {STATUS_LABEL[client.status ?? "active"]}
                </span>
                <p className="min-w-0 text-sm text-slate-500">{client.notes || "備考なし"}</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => startEdit(client)}
                    className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                    aria-label="編集"
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(client)}
                    disabled={deletingId === client.id}
                    className="rounded-lg p-2 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                    aria-label="削除"
                  >
                    {deletingId === client.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
