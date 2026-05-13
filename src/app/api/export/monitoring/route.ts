import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildMonitoringExcel,
  type MonitoringGoalEvaluationInput,
  type MonitoringExcelInput,
} from "@/lib/excel/monitoring-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = (await req.json()) as MonitoringExcelInput;
  if (!body?.clientName) {
    return new Response("clientName required", { status: 400 });
  }
  const { buffer, filename } = await buildMonitoringExcel(body);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}

type SupportPlanGoal = {
  priority: number;
  specific_goal: string;
  user_role: string;
  support_content: string;
  support_duration: string;
};

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return new Response("id required", { status: 400 });

  const { data: monitoring, error } = await supabase
    .from("monitorings")
    .select("*, support_plans(*)")
    .eq("id", id)
    .single();
  if (error || !monitoring) return new Response("not found", { status: 404 });

  const evals = (Array.isArray(monitoring.goal_evaluations) ? monitoring.goal_evaluations : []) as MonitoringGoalEvaluationInput[];
  const plan = monitoring.support_plans as Record<string, unknown> | null;

  const planGoals: SupportPlanGoal[] = Array.isArray(plan?.goals_json) ? (plan!.goals_json as SupportPlanGoal[]) : [];

  const { buffer, filename } = await buildMonitoringExcel({
    clientName: monitoring.client_name,
    userHope: (plan?.attainment_goal as string | undefined) ?? undefined,
    longTermGoal: (plan?.long_term_goal as string | undefined) ?? undefined,
    shortTermGoal: (plan?.short_term_goals as string | undefined) ?? undefined,
    supportPlan: plan
      ? {
          authorName: (plan.author_name as string | undefined) ?? undefined,
          serviceManagerName: (plan.service_manager_name as string | undefined) ?? undefined,
          createdDate: (plan.created_date as string | undefined) ?? undefined,
          planStartDate: (plan.plan_start_date as string | undefined) ?? undefined,
          planEndDate: (plan.plan_end_date as string | undefined) ?? undefined,
          attainmentGoal: (plan.attainment_goal as string | undefined) ?? undefined,
          overallSupportPolicy: (plan.overall_support_policy as string | undefined) ?? undefined,
          goals: planGoals,
        }
      : undefined,
    goalEvaluations: evals,
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
