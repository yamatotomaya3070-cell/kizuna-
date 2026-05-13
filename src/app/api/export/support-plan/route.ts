import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildSupportPlanExcel,
  type SupportPlanGoalInput,
  type SupportPlanExcelInput,
} from "@/lib/excel/support-plan-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 個別支援計画のフォームから直接 Excel を組み立てて返す
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = (await req.json()) as SupportPlanExcelInput;
  if (!body?.clientName || !body?.planStartDate || !body?.planEndDate) {
    return new Response("required fields missing", { status: 400 });
  }
  const { buffer, filename } = await buildSupportPlanExcel(body);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return new Response("id required", { status: 400 });

  const { data: plan, error } = await supabase
    .from("support_plans")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !plan) return new Response("not found", { status: 404 });

  const goals = (Array.isArray(plan.goals_json) ? plan.goals_json : []) as SupportPlanGoalInput[];

  const { buffer, filename } = await buildSupportPlanExcel({
    clientName: plan.client_name,
    authorName: plan.author_name ?? undefined,
    serviceManagerName: plan.service_manager_name ?? undefined,
    createdDate: plan.created_date ?? undefined,
    planStartDate: plan.plan_start_date,
    planEndDate: plan.plan_end_date,
    attainmentGoal: plan.attainment_goal ?? undefined,
    overallSupportPolicy: plan.overall_support_policy ?? undefined,
    longTermGoal: plan.long_term_goal ?? undefined,
    shortTermGoal: plan.short_term_goals ?? undefined,
    goals,
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
