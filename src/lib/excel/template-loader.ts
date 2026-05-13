import fs from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";

const TEMPLATES_DIR = path.join(process.cwd(), "templates");
const CELL_MAPPINGS_DIR = path.join(TEMPLATES_DIR, "cell_mappings");

export async function loadTemplateWorkbook(filename: string): Promise<ExcelJS.Workbook> {
  const buf = await fs.readFile(path.join(TEMPLATES_DIR, filename));
  const wb = new ExcelJS.Workbook();
  // ExcelJS は ArrayBuffer を期待する
  await wb.xlsx.load(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  return wb;
}

export async function loadCellMapping<T = unknown>(name: "diary" | "support_plan" | "monitoring"): Promise<T> {
  const buf = await fs.readFile(path.join(CELL_MAPPINGS_DIR, `${name}.json`), "utf-8");
  return JSON.parse(buf) as T;
}

export async function workbookToBuffer(wb: ExcelJS.Workbook): Promise<Buffer> {
  const arr = await wb.xlsx.writeBuffer();
  return Buffer.from(arr);
}

/** セル結合範囲の先頭セルを取得（結合セルへの書き込みは先頭セルにする必要がある） */
export function topLeftOfMerge(ws: ExcelJS.Worksheet, addr: string): string {
  // ExcelJS は ws.getCell(addr) で結合セル取得時に master を返さないので手動で探索
  const merges = (ws as unknown as { _merges?: Record<string, { top: number; left: number }> })._merges;
  if (!merges) return addr;
  for (const range of Object.values(merges)) {
    // master 位置を取得（exceljs 内部表現は版で揺れる）
    const cell = ws.getCell(addr);
    if (cell.isMerged) {
      return cell.master?.address ?? addr;
    }
  }
  return addr;
}

export function setCell(ws: ExcelJS.Worksheet, addr: string, value: string | number | null | undefined) {
  if (value === undefined || value === null) return;
  const cell = ws.getCell(addr);
  if (cell.isMerged && cell.master) {
    cell.master.value = value;
  } else {
    cell.value = value;
  }
}

export type DiaryCellMapping = {
  template_file: string;
  source_sheet: string;
  static: Record<string, string>;
  header: { date_label_cell: string; weekday_cell: string; date_format: string };
  client_rows: { start: number; end: number; max_clients: number };
  per_client_columns: {
    row_no: string;
    client_name: string;
    attendance: string;
    lunch: string;
    transport: string;
    work_eval_columns: Record<string, string>;
    life_eval_columns: Record<string, string>;
    checkbox_mark_on: string;
    checkbox_mark_off: string;
  };
  section_cells: { work_morning_content: string; work_afternoon_content: string; remarks: string };
  signature_cells: { staff_in_charge_value: string; service_manager_value: string; confirm_date_value: string };
  evaluation_labels: {
    work: { key: string; label: string }[];
    life: { key: string; label: string }[];
  };
};

export type SupportPlanCellMapping = {
  template_file: string;
  source_sheet: string;
  static: { title_cell: string; table_columns: Record<string, string>; [k: string]: unknown };
  header_fields: {
    client_name_value: string;
    author_value: string;
    created_date_value: string;
    service_manager_value: string;
    implementation_period_value_cell: string;
    implementation_period_format: string;
  };
  policy_fields: {
    attainment_goal_value: string;
    overall_support_policy_value: string;
    long_term_goal_value: string;
    short_term_goal_value: string;
  };
  goals_table: {
    goals: { index: number; cells: { priority: string; specific_goal: string; user_role: string; support_content: string; support_duration: string } }[];
  };
};

export type MonitoringCellMapping = {
  template_file: string;
  source_sheet: string;
  static: { title_cell: string; table_columns: Record<string, string>; [k: string]: unknown };
  header_fields: {
    client_name_value: string;
    user_hope_value: string;
    long_term_goal_value: string;
    short_term_goal_value: string;
  };
  goals_table: {
    goals: { index: number; cells: { user_hope: string; user_role: string; support_content: string; remaining_issue: string; evaluation: string } }[];
  };
};
