import {
  loadTemplateWorkbook,
  loadCellMapping,
  setCell,
  type MonitoringCellMapping,
  type SupportPlanCellMapping,
} from "./template-loader";

export type MonitoringGoalEvaluationInput = {
  index: number;
  user_hope: string;
  user_role: string;
  support_content: string;
  remaining_issue: string;
  evaluation: "A" | "B" | "C" | "";
};

export type MonitoringExcelInput = {
  clientName: string;
  userHope?: string;
  longTermGoal?: string;
  shortTermGoal?: string;
  // 計画書側の値も同じブックに同梱したいので渡せるようにする（任意）
  supportPlan?: {
    authorName?: string;
    serviceManagerName?: string;
    createdDate?: string;
    planStartDate?: string;
    planEndDate?: string;
    attainmentGoal?: string;
    overallSupportPolicy?: string;
    goals?: {
      priority: number;
      specific_goal: string;
      user_role: string;
      support_content: string;
      support_duration: string;
    }[];
  };
  goalEvaluations: MonitoringGoalEvaluationInput[];
};

function jaDateParts(d: string) {
  const dt = new Date(d + "T00:00:00");
  return { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() };
}

export async function buildMonitoringExcel(input: MonitoringExcelInput): Promise<{ buffer: Buffer; filename: string }> {
  const mapping = await loadCellMapping<MonitoringCellMapping>("monitoring");
  const planMapping = await loadCellMapping<SupportPlanCellMapping>("support_plan");
  const wb = await loadTemplateWorkbook(mapping.template_file);

  const ws = wb.getWorksheet(mapping.source_sheet);
  if (!ws) throw new Error(`シート ${mapping.source_sheet} が見つかりません`);

  setCell(ws, mapping.header_fields.client_name_value, input.clientName);
  if (input.userHope) setCell(ws, mapping.header_fields.user_hope_value, input.userHope);
  if (input.longTermGoal) setCell(ws, mapping.header_fields.long_term_goal_value, input.longTermGoal);
  if (input.shortTermGoal) setCell(ws, mapping.header_fields.short_term_goal_value, input.shortTermGoal);

  // 目標ごとの評価
  input.goalEvaluations.slice(0, mapping.goals_table.goals.length).forEach((g, i) => {
    const slot = mapping.goals_table.goals[i];
    setCell(ws, slot.cells.user_hope, g.user_hope);
    setCell(ws, slot.cells.user_role, g.user_role);
    setCell(ws, slot.cells.support_content, g.support_content);
    setCell(ws, slot.cells.remaining_issue, g.remaining_issue);
    setCell(ws, slot.cells.evaluation, g.evaluation);
  });

  // 同一ブック内の「支援計画」シートも更新（手元の支援計画スナップショットを同梱）
  if (input.supportPlan) {
    const planWs = wb.getWorksheet(planMapping.source_sheet);
    if (planWs) {
      setCell(planWs, planMapping.header_fields.client_name_value, input.clientName);
      if (input.supportPlan.authorName) setCell(planWs, planMapping.header_fields.author_value, input.supportPlan.authorName);
      if (input.supportPlan.serviceManagerName) setCell(planWs, planMapping.header_fields.service_manager_value, input.supportPlan.serviceManagerName);
      if (input.supportPlan.createdDate) {
        const c = jaDateParts(input.supportPlan.createdDate);
        setCell(planWs, planMapping.header_fields.created_date_value, `　${c.y}年 　${c.m}月 　${c.d}日`);
      }
      if (input.supportPlan.planStartDate && input.supportPlan.planEndDate) {
        const s = jaDateParts(input.supportPlan.planStartDate);
        const e = jaDateParts(input.supportPlan.planEndDate);
        const periodText = planMapping.header_fields.implementation_period_format
          .replace("{start_y}", String(s.y))
          .replace("{start_m}", String(s.m))
          .replace("{start_d}", String(s.d))
          .replace("{end_y}", String(e.y))
          .replace("{end_m}", String(e.m))
          .replace("{end_d}", String(e.d));
        setCell(planWs, planMapping.header_fields.implementation_period_value_cell, periodText);
      }
      if (input.supportPlan.attainmentGoal) setCell(planWs, planMapping.policy_fields.attainment_goal_value, input.supportPlan.attainmentGoal);
      if (input.supportPlan.overallSupportPolicy) setCell(planWs, planMapping.policy_fields.overall_support_policy_value, input.supportPlan.overallSupportPolicy);
      (input.supportPlan.goals ?? []).slice(0, planMapping.goals_table.goals.length).forEach((g, i) => {
        const slot = planMapping.goals_table.goals[i];
        setCell(planWs, slot.cells.priority, g.priority);
        setCell(planWs, slot.cells.specific_goal, g.specific_goal);
        setCell(planWs, slot.cells.user_role, g.user_role);
        setCell(planWs, slot.cells.support_content, g.support_content);
        setCell(planWs, slot.cells.support_duration, g.support_duration);
      });
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  return {
    buffer: Buffer.from(buffer),
    filename: `モニタリング_${input.clientName}.xlsx`,
  };
}
