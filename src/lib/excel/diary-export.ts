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
  attendance: string;        // ○ △ ●
  lunch: string;             // ○ ●
  transportGo: string;       // ○ ●
  transportReturn: string;   // ○ ●
  workStatus: string;        // 様子（職業指導員）AI要約テキスト
  workComment: string;       // コメント（職業指導員）自由コメント
  lifeStatus: string;        // 様子（生活支援員）AI要約テキスト
  lifeComment: string;       // コメント（生活支援員）自由コメント
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

  const tmpl = wb.getWorksheet(mapping.source_sheet);
  if (!tmpl) throw new Error(`テンプレートシート ${mapping.source_sheet} が見つかりません`);

  const { m, d, weekday } = jaDate(input.date);
  const newSheetName = `${m}月${d}日`;

  const existing = wb.getWorksheet(newSheetName);
  if (existing) wb.removeWorksheet(existing.id);

  const ws: ExcelJS.Worksheet = wb.addWorksheet(newSheetName);
  tmpl.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const newCell = ws.getCell(rowNumber, colNumber);
      newCell.value = cell.value;
      if (cell.style) newCell.style = { ...cell.style };
    });
    if (row.height) ws.getRow(rowNumber).height = row.height;
  });
  tmpl.columns.forEach((col, i) => {
    if (col.width) ws.getColumn(i + 1).width = col.width;
  });
  type MergeInternal = { _merges?: Record<string, { top: number; left: number; bottom: number; right: number }> };
  const tmplMerges = (tmpl as unknown as MergeInternal)._merges;
  if (tmplMerges) {
    for (const range of Object.values(tmplMerges)) {
      ws.mergeCells(range.top, range.left, range.bottom, range.right);
    }
  }

  // ── ヘッダ
  setCell(ws, mapping.header.date_label_cell, `${m}月${d}日`);
  setCell(ws, mapping.header.weekday_cell, `（${weekday}）`);

  // ── 利用者行
  const { start } = mapping.client_rows;
  const cols = mapping.per_client_columns;

  input.rows.forEach((row, i) => {
    const r = start + i;
    if (r > mapping.client_rows.end) return;
    setCell(ws, `${cols.row_no}${r}`, row.no);
    setCell(ws, `${cols.client_name}${r}`, row.clientName);
    setCell(ws, `${cols.attendance}${r}`, row.attendance);
    setCell(ws, `${cols.lunch}${r}`, row.lunch);
    setCell(ws, `${cols.transport_go}${r}`, row.transportGo);
    setCell(ws, `${cols.transport_return}${r}`, row.transportReturn);
    setCell(ws, `${cols.work_status}${r}`, row.workStatus);
    setCell(ws, `${cols.work_comment}${r}`, row.workComment);
    setCell(ws, `${cols.life_status}${r}`, row.lifeStatus);
    setCell(ws, `${cols.life_comment}${r}`, row.lifeComment);
  });

  if (input.workMorningContent) setCell(ws, mapping.section_cells.work_morning_content, input.workMorningContent);
  if (input.workAfternoonContent) setCell(ws, mapping.section_cells.work_afternoon_content, input.workAfternoonContent);
  if (input.facilityRemarks) setCell(ws, mapping.section_cells.remarks, input.facilityRemarks);
  if (input.staffInCharge) setCell(ws, mapping.signature_cells.staff_in_charge_value, `担当者：${input.staffInCharge}`);
  if (input.serviceManager) setCell(ws, mapping.signature_cells.service_manager_value, `サービス管理責任者確認：${input.serviceManager}`);
  if (input.confirmDate) setCell(ws, mapping.signature_cells.confirm_date_value, `確認日：${input.confirmDate}`);

  const buffer = await wb.xlsx.writeBuffer();
  return {
    buffer: Buffer.from(buffer),
    filename: `業務日報_${input.date}.xlsx`,
  };
}
