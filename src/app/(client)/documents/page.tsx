"use client";

import { useState, useRef } from "react";
import { Upload, FileText, Download, CheckCircle2, Loader2, FolderOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function DocumentsPage() {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; url: string; size: string }[]>([]);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const path = `documents/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage
        .from("welfare-docs")
        .upload(path, file);

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("welfare-docs")
        .getPublicUrl(path);

      setUploadedFiles((prev) => [
        {
          name: file.name,
          url: urlData.publicUrl,
          size: `${Math.round(file.size / 1024)} KB`,
        },
        ...prev,
      ]);
      showToast("アップロード完了しました");
    } catch {
      showToast("アップロードに失敗しました。Supabase Storageのバケットを確認してください。");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="p-8 space-y-8 relative">
      {/* トースト */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-slate-800 text-white text-sm font-semibold px-4 py-3 rounded-xl shadow-lg">
          <CheckCircle2 size={16} className="text-blue-400" />
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">書類保管庫</h2>
          <p className="text-sm text-slate-500 mt-1">登録書類の一覧・アップロード</p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.xlsx,.doc,.xls"
            onChange={handleUpload}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className={`flex items-center gap-2 bg-blue-900 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-blue-900 transition-colors cursor-pointer ${
              uploading ? "opacity-50 cursor-wait" : ""
            }`}
          >
            {uploading ? (
              <><Loader2 size={15} className="animate-spin" />アップロード中...</>
            ) : (
              <><Upload size={15} />書類をアップロード</>
            )}
          </label>
        </div>
      </div>

      {/* アップロード済みファイル（Supabase Storage） */}
      {uploadedFiles.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-slate-600 mb-3">アップロード済み</h3>
          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-blue-200">
            <table className="w-full text-sm">
              <thead className="bg-white text-blue-900 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-6 py-3 text-left">ファイル名</th>
                  <th className="px-6 py-3 text-left">サイズ</th>
                  <th className="px-6 py-3 text-left">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {uploadedFiles.map((f, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-6 py-4 flex items-center gap-2">
                      <FileText size={16} className="text-blue-900" />
                      {f.name}
                    </td>
                    <td className="px-6 py-4 text-slate-500">{f.size}</td>
                    <td className="px-6 py-4">
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-900 hover:underline flex items-center gap-1 text-xs"
                      >
                        <Download size={13} /> ダウンロード
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* アップロードがない場合の空状態 */}
      {uploadedFiles.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm py-20 text-center">
          <FolderOpen size={36} className="mx-auto mb-3 text-slate-200" />
          <p className="text-sm text-slate-400 font-medium">書類がまだアップロードされていません</p>
          <p className="text-xs text-slate-300 mt-1">上の「書類をアップロード」から追加してください</p>
        </div>
      )}
    </div>
  );
}
