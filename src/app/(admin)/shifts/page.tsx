"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CalendarRange,
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Download,
} from "lucide-react";
import {
  importShifts,
  listShifts,
  deleteShift,
  type ShiftImportRow,
} from "@/app/actions/shifts";

type ShiftRow = {
  id: string;
  shift_date: string;
  staff_name: string;
  role: string;
  shift_type: string | null;
  start_time: string | null;
  end_time: string | null;
};

const COLUMN_ALIASES: Record<string, string> = {
  date: "shift_date",
  shift_date: "shift_date",
  勤務日: "shift_date",
  日付: "shift_date",
  facility_id: "facility_id",
  facility_name: "facility_name",
  事業所: "facility_name",
  事業所名: "facility_name",
  staff_name: "staff_name",
  職員名: "staff_name",
  氏名: "staff_name",
  role: "role",
  職種: "role",
  shift_type: "shift_type",
  勤務区分: "shift_type",
  start_time: "start_time",
  開始時間: "start_time",
  end_time: "end_time",
  終了時間: "end_time",
};

// シンプルなCSVパーサ（ダブルクォート対応・カンマ区切り）
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuote = false;
  // BOM除去
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuote) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuote = false;
      } else field += ch;
    } else {
      if (ch === '"') inQuote = true;
      else if (ch === ",") { cur.push(field); field = ""; }
      else if (ch === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else if (ch === "\r") { /* skip */ }
      else field += ch;
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur); }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

function toIsoDate(raw: string): string {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // YYYY/M/D 等にも対応
  const m = s.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return s;
}

function toIsoTime(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}:${m[3] ?? "00"}`;
}

function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ShiftsPage() {
  const today = toLocalDateStr(new Date());
  const twoWeeks = new Date();
  twoWeeks.setDate(twoWeeks.getDate() + 13);

  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(toLocalDateStr(twoWeeks));

  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [preview, setPreview] = useState<ShiftImportRow[]>([]);
  const [previewFileName, setPreviewFileName] = useState("");
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    inserted: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  const fetchShifts = useCallback(async () => {
    setLoading(true);
    const { data } = await listShifts(fromDate, toDate);
    setShifts((data as ShiftRow[]) ?? []);
    setLoading(false);
  }, [fromDate, toDate]);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  const handleFile = async (file: File) => {
    setImportResult(null);
    setParseErrors([]);
    setPreview([]);
    setPreviewFileName(file.name);

    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length === 0) {
      setParseErrors(["空のファイルです"]);
      return;
    }

    const header = rows[0].map((h) => h.trim());
    const idx: Record<string, number> = {};
    header.forEach((h, i) => {
      const key = COLUMN_ALIASES[h] ?? COLUMN_ALIASES[h.toLowerCase()];
      if (key) idx[key] = i;
    });

    if (idx.shift_date === undefined || idx.staff_name === undefined) {
      setParseErrors([
        "必須カラムが不足しています。",
        "必須: shift_date（または date / 勤務日 / 日付）, staff_name（または 職員名 / 氏名）",
      ]);
      return;
    }

    const errs: string[] = [];
    const parsed: ShiftImportRow[] = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const shiftDate = toIsoDate(r[idx.shift_date] ?? "");
      const staffName = (r[idx.staff_name] ?? "").trim();
      if (!shiftDate || !staffName) {
        errs.push(`${i + 1}行目: 必須項目が空です`);
        continue;
      }
      parsed.push({
        shiftDate,
        staffName,
        role: idx.role !== undefined ? (r[idx.role] ?? "").trim() || null : null,
        shiftType: idx.shift_type !== undefined ? (r[idx.shift_type] ?? "").trim() || null : null,
        startTime: idx.start_time !== undefined ? toIsoTime(r[idx.start_time] ?? "") : null,
        endTime: idx.end_time !== undefined ? toIsoTime(r[idx.end_time] ?? "") : null,
        facilityName: idx.facility_name !== undefined ? (r[idx.facility_name] ?? "").trim() || null : null,
      });
    }
    setParseErrors(errs);
    setPreview(parsed);
  };

  const handleImport = async () => {
    if (preview.length === 0) return;
    setImporting(true);
    const result = await importShifts(preview);
    setImporting(false);
    setImportResult({
      inserted: result.inserted,
      skipped: result.skipped,
      errors: result.errors,
    });
    if (result.success) {
      setPreview([]);
      setPreviewFileName("");
      fetchShifts();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("このシフトを削除します。よろしいですか？")) return;
    const res = await deleteShift(id);
    if (res.error) {
      alert("削除に失敗しました: " + res.error);
      return;
    }
    fetchShifts();
  };

  const downloadTemplate = () => {
    const csv =
      "shift_date,staff_name,role,shift_type,start_time,end_time\n" +
      "2026-05-13,山田 太郎,work,日勤,09:00,18:00\n" +
      "2026-05-13,佐藤 花子,life,午前,09:00,13:00\n";
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "shift_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // 日付ごとにグルーピング
  const grouped = shifts.reduce<Record<string, ShiftRow[]>>((acc, s) => {
    (acc[s.shift_date] ??= []).push(s);
    return acc;
  }, {});
  const groupedKeys = Object.keys(grouped).sort();

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto pb-20">
      <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6">
        <CalendarRange size={18} className="text-blue-900" />
        シフト管理
      </h1>

      {/* 取込 */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 mb-6 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <Upload size={16} className="text-blue-900" />
            CSV取込
          </h2>
          <button
            type="button"
            onClick={downloadTemplate}
            className="flex items-center gap-1 text-xs font-semibold text-blue-900 hover:text-blue-950"
          >
            <Download size={13} />
            テンプレートCSV
          </button>
        </div>

        <p className="text-xs text-slate-500 mb-3">
          必須カラム: <code className="bg-slate-100 px-1 rounded">shift_date</code>{" "}
          (または日付/勤務日),{" "}
          <code className="bg-slate-100 px-1 rounded">staff_name</code> (または氏名/職員名)。
          任意: role / shift_type / start_time / end_time。
          同じ日付・同じ事業所・同じ職員名は上書きされます。
        </p>

        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
          className="block w-full text-xs text-slate-600 file:mr-3 file:px-3 file:py-2 file:rounded-xl file:border-0 file:bg-blue-50 file:text-blue-900 file:font-semibold hover:file:bg-blue-100"
        />

        {parseErrors.length > 0 && (
          <div className="mt-3 rounded-xl bg-red-50 border border-red-200 p-3">
            <div className="flex items-center gap-1 text-red-700 font-bold text-xs mb-1">
              <AlertTriangle size={13} />
              CSV解析エラー
            </div>
            <ul className="list-disc ml-4 text-xs text-red-700 space-y-0.5">
              {parseErrors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
              {parseErrors.length > 10 && <li>...他 {parseErrors.length - 10} 件</li>}
            </ul>
          </div>
        )}

        {preview.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-600 mb-2">
              プレビュー（{previewFileName} / {preview.length} 件）
            </p>
            <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr className="text-left text-slate-500">
                    <th className="px-2 py-1.5">日付</th>
                    <th className="px-2 py-1.5">職員名</th>
                    <th className="px-2 py-1.5">職種</th>
                    <th className="px-2 py-1.5">区分</th>
                    <th className="px-2 py-1.5">開始</th>
                    <th className="px-2 py-1.5">終了</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 100).map((r, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-2 py-1.5">{r.shiftDate}</td>
                      <td className="px-2 py-1.5 font-semibold">{r.staffName}</td>
                      <td className="px-2 py-1.5 text-slate-500">{r.role ?? ""}</td>
                      <td className="px-2 py-1.5 text-slate-500">{r.shiftType ?? ""}</td>
                      <td className="px-2 py-1.5 text-slate-500">{r.startTime ?? ""}</td>
                      <td className="px-2 py-1.5 text-slate-500">{r.endTime ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.length > 100 && (
                <p className="text-center text-xs text-slate-400 py-2">
                  ...他 {preview.length - 100} 件
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleImport}
              disabled={importing}
              className={`mt-3 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                importing
                  ? "bg-slate-100 text-slate-400"
                  : "bg-blue-900 text-white shadow-sm hover:bg-blue-950 active:scale-[0.98]"
              }`}
            >
              {importing ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  取り込み中...
                </>
              ) : (
                <>
                  <Upload size={14} />
                  {preview.length} 件を取り込み
                </>
              )}
            </button>
          </div>
        )}

        {importResult && (
          <div
            className={`mt-4 rounded-xl border p-3 ${
              importResult.errors.length > 0
                ? "bg-red-50 border-red-200"
                : "bg-blue-50 border-blue-200"
            }`}
          >
            <div
              className={`flex items-center gap-1 font-bold text-xs ${
                importResult.errors.length > 0 ? "text-red-700" : "text-blue-900"
              }`}
            >
              {importResult.errors.length > 0 ? (
                <AlertTriangle size={13} />
              ) : (
                <CheckCircle2 size={13} />
              )}
              取込結果
            </div>
            <p className="text-xs mt-1 text-slate-700">
              登録 / 更新: {importResult.inserted} 件 ／ スキップ: {importResult.skipped} 件
            </p>
            {importResult.errors.length > 0 && (
              <ul className="list-disc ml-4 text-xs text-red-700 mt-1 space-y-0.5">
                {importResult.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* 一覧 */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <h2 className="font-bold text-slate-800 mb-3">登録済みシフト</h2>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <label className="text-xs text-slate-500" htmlFor="from-date">
            期間:
          </label>
          <input
            id="from-date"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="text-xs px-2 py-1.5 border border-slate-200 rounded-lg"
          />
          <span className="text-xs text-slate-400">〜</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="text-xs px-2 py-1.5 border border-slate-200 rounded-lg"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 size={22} className="animate-spin text-slate-300" />
          </div>
        ) : groupedKeys.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-10">
            登録されたシフトはありません
          </p>
        ) : (
          <div className="space-y-3">
            {groupedKeys.map((d) => (
              <div key={d} className="border border-slate-100 rounded-xl p-3">
                <p className="text-xs font-bold text-slate-600 mb-2">
                  {new Date(d + "T00:00:00").toLocaleDateString("ja-JP", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    weekday: "short",
                  })}
                </p>
                <div className="flex flex-wrap gap-2">
                  {grouped[d].map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5"
                    >
                      <span className="text-xs font-semibold text-slate-700">{s.staff_name}</span>
                      {s.shift_type && (
                        <span className="text-[10px] text-slate-500">{s.shift_type}</span>
                      )}
                      {(s.start_time || s.end_time) && (
                        <span className="text-[10px] text-slate-400">
                          {s.start_time?.slice(0, 5) ?? ""}-{s.end_time?.slice(0, 5) ?? ""}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(s.id)}
                        className="text-slate-400 hover:text-red-500 ml-1"
                        aria-label="削除"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
