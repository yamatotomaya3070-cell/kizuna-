import {
  loadTemplateWorkbook,
  loadCellMapping,
  setCell,
  type SupportPlanCellMapping,
} from "./template-loader";

export type SupportPlanGoalInput = {
  priority: number;
  specific_goal: string;
  user_role: string;
  support_content: string;
  support_duration: string;
};

export type SupportPlanExcelInput = {
  clientName: string;
  authorName?: string;
  serviceManagerName?: string;
  createdDate?: string; // YYYY-MM-DD
  planStartDate: string;
  planEndDate: string;
  attainmentGoal?: string;
  overallSupportPolicy?: string;
  longTermGoal?: string;
  shortTermGoal?: string;
  goals: SupportPlanGoalInput[]; // up to 3 entries
};

function jaDateParts(d: string) {
  const dt = new Date(d + "T00:00:00");
  return { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() };
}

export async function buildSupportPlanExcel(input: SupportPlanExcelInput): Promise<{ buffer: Buffer; filename: string }> {
  const mapping = await loadCellMapping<SupportPlanCellMapping>("support_plan");
  const wb = await loadTemplateWorkbook(mapping.template_file);
  const ws = wb.getWorksheet(mapping.source_sheet);
  if (!ws) throw new Error(`シート ${mapping.source_sheet} が見つかりません`);

  setCell(ws, mapping.header_fields.client_name_value, input.clientName);
  if (input.authorName) setCell(ws, mapping.header_fields.author_value, input.authorName);
  if (input.serviceManagerName) setCell(ws, mapping.header_fields.service_manager_value, input.serviceManagerName);
  if (input.createdDate) {
    const c = jaDateParts(input.createdDate);
    setCell(ws, mapping.header_fields.created_date_value, `　${c.y}年 　${c.m}月 　${c.d}日`);
  }

  const s = jaDateParts(input.planStartDate);
  const e = jaDateParts(input.planEndDate);
  const periodText = mapping.header_fields.implementation_period_format
    .replace("{start_y}", String(s.y))
    .replace("{start_m}", String(s.m))
    .replace("{start_d}", String(s.d))
    .replace("{end_y}", String(e.y))
    .replace("{end_m}", String(e.m))
    .replace("{end_d}", String(e.d));
  setCell(ws, mapping.header_fields.implementation_period_value_cell, periodText);

  if (input.attainmentGoal) setCell(ws, mapping.policy_fields.attainment_goal_value, input.attainmentGoal);
  if (input.overallSupportPolicy) setCell(ws, mapping.policy_fields.overall_support_policy_value, input.overallSupportPolicy);
  if (input.longTermGoal) setCell(ws, mapping.policy_fields.long_term_goal_value, `長期目標：${input.longTermGoal}`);
  if (input.shortTermGoal) setCell(ws, mapping.policy_fields.short_term_goal_value, `短期目標：${input.shortTermGoal}`);

  // Goals
  input.goals.slice(0, mapping.goals_table.goals.length).forEach((g, i) => {
    const slot = mapping.goals_table.goals[i];
    setCell(ws, slot.cells.priority, g.priority);
    setCell(ws, slot.cells.specific_goal, g.specific_goal);
    setCell(ws, slot.cells.user_role, g.user_role);
    setCell(ws, slot.cells.support_content, g.support_content);
    setCell(ws, slot.cells.support_duration, g.support_duration);
  });

  // モニタリングシートは未編集のまま同梱（個別支援計画とモニタリングは同一ブックなので、編集する時に紐付けして上書きする運用）

  const buffer = await wb.xlsx.writeBuffer();
  return {
    buffer: Buffer.from(buffer),
    filename: `個別支援計画_${input.clientName}_${input.planStartDate}.xlsx`,
  };
}
