import ExcelJS from "exceljs";
import {
  loadTemplateWorkbook,
  loadCellMapping,
  setCell,
  type DiaryCellMapping,
} from "./template-loader";

export type DiaryRowInput = {
  no: number;
  clientName: string;
  attendance: string;     // ○ △ ●
  lunch: string;          // ○ ●
  transport: string;      // ○ △ ●
  workEval: Partial<Record<"active_engagement" | "stable_engagement" | "not_focused" | "no_motivation", boolean>>;
  lifeEval: Partial<Record<"stable_passing" | "calm_passing" | "emotionally_unstable" | "irritated", boolean>>;
  remarks?: string;
};

export type DiaryExcelInput = {
  date: string; // YYYY-MM-DD
  rows: DiaryRowInput[];
  workMorningContent?: string;
  workAfternoonContent?: string;
  facilityRemarks?: string;
  staffInCharge?: string;
  serviceManager?: string;
  confirmDate?: string;
};

function jaDate(date: string) {
  const d = new Date(date + "T00:00:00");
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  return { m, d: day, weekday: weekdays[d.getDay()] };
}

export async function buildDiaryExcel(input: DiaryExcelInput): Promise<{ buffer: Buffer; filename: string }> {
  const mapping = await loadCellMapping<DiaryCellMapping>("diary");
  const wb = await loadTemplateWorkbook(mapping.template_file);

  // テンプレートシートを複製して、日付シート名で新規シートを作る
  const tmpl = wb.getWorksheet(mapping.source_sheet);
  if (!tmpl) throw new Error(`テンプレートシート ${mapping.source_sheet} が見つかりません`);

  const { m, d, weekday } = jaDate(input.date);
  const newSheetName = `${m}月${d}日`;

  // 同名シートが既にあれば削除
  const existing = wb.getWorksheet(newSheetName);
  if (existing) wb.removeWorksheet(existing.id);

  // ExcelJS には clone があるが対応版が異なるので、テンプレを直接書き換えて新名にリネーム
  // 他のシート（既存日付シート）を尊重するため、テンプレを複製してから書き込む
  const ws: ExcelJS.Worksheet = wb.addWorksheet(newSheetName);
  // テンプレートシートからセルを丸ごとコピー
  tmpl.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const newCell = ws.getCell(rowNumber, colNumber);
      newCell.value = cell.value;
      if (cell.style) newCell.style = { ...cell.style };
    });
    if (row.height) ws.getRow(rowNumber).height = row.height;
  });
  // 列幅
  tmpl.columns.forEach((col, i) => {
    if (col.width) ws.getColumn(i + 1).width = col.width;
  });
  // 結合
  type MergeInternal = { _merges?: Record<string, { top: number; left: number; bottom: number; right: number }> };
  const tmplMerges = (tmpl as unknown as MergeInternal)._merges;
  if (tmplMerges) {
    for (const range of Object.values(tmplMerges)) {
      ws.mergeCells(range.top, range.left, range.bottom, range.right);
    }
  }

  // ── ヘッダ：日付・曜日
  setCell(ws, mapping.header.date_label_cell, `${m}月${d}日`);
  setCell(ws, mapping.header.weekday_cell, `（${weekday}）`);

  // ── 利用者行
  const { start } = mapping.client_rows;
  const cols = mapping.per_client_columns;
  const markOn = cols.checkbox_mark_on;
  const markOff = cols.checkbox_mark_off;

  input.rows.forEach((row, i) => {
    const r = start + i;
    if (r > mapping.client_rows.end) return; // テンプレ上限を超えたら捨てる（要件外）
    setCell(ws, `${cols.row_no}${r}`, row.no);
    setCell(ws, `${cols.client_name}${r}`, row.clientName);
    setCell(ws, `${cols.attendance}${r}`, row.attendance);
    setCell(ws, `${cols.lunch}${r}`, row.lunch);
    setCell(ws, `${cols.transport}${r}`, row.transport);
    for (const [key, col] of Object.entries(cols.work_eval_columns)) {
      const checked = row.workEval[key as keyof typeof row.workEval] === true;
      setCell(ws, `${col}${r}`, checked ? markOn : markOff);
    }
    for (const [key, col] of Object.entries(cols.life_eval_columns)) {
      const checked = row.lifeEval[key as keyof typeof row.lifeEval] === true;
      setCell(ws, `${col}${r}`, checked ? markOn : markOff);
    }
  });

  // ── 末尾：作業内容・備考・サイン欄
  if (input.workMorningContent) setCell(ws, mapping.section_cells.work_morning_content, input.workMorningContent);
  if (input.workAfternoonContent) setCell(ws, mapping.section_cells.work_afternoon_content, input.workAfternoonContent);
  if (input.facilityRemarks) setCell(ws, mapping.section_cells.remarks, input.facilityRemarks);
  if (input.staffInCharge) setCell(ws, mapping.signature_cells.staff_in_charge_value, input.staffInCharge);
  if (input.serviceManager) setCell(ws, mapping.signature_cells.service_manager_value, input.serviceManager);
  if (input.confirmDate) setCell(ws, mapping.signature_cells.confirm_date_value, input.confirmDate);

  const buffer = await wb.xlsx.writeBuffer();
  return {
    buffer: Buffer.from(buffer),
    filename: `業務日報_${input.date}.xlsx`,
  };
}
