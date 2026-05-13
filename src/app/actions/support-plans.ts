"use server";

import { createClient } from "@/lib/supabase/server";

export type SupportPlanGoal = {
  priority: number;
  specific_goal: string;
  user_role: string;
  support_content: string;
  support_duration: string;
  consideration_points?: string;
};

export type SupportPlanPayload = {
  id?: string;
  clientName: string;
  clientId?: string | null;
  planVersion?: number;
  planStartDate: string;
  planEndDate: string;
  authorName?: string;
  serviceManagerName?: string;
  createdDate?: string;
  meetingDate?: string;
  consentDate?: string;
  issuedDate?: string;
  staffInCharge?: string;
  assessmentSummary?: string;
  userNeeds?: string;
  familyNeeds?: string;
  attainmentGoal?: string;
  overallSupportPolicy?: string;
  longTermGoal?: string;
  shortTermGoals?: string;
  goals: SupportPlanGoal[];
  rawGeneratedText?: string;
};

type Row = {
  id: string;
  facility_id: string;
  client_id: string | null;
  client_name: string;
  plan_version: number;
  plan_start_date: string;
  plan_end_date: string;
  author_name: string | null;
  service_manager_name: string | null;
  created_date: string | null;
  meeting_date: string | null;
  consent_date: string | null;
  issued_date: string | null;
  staff_in_charge: string | null;
  assessment_summary: string | null;
  user_needs: string | null;
  family_needs: string | null;
  attainment_goal: string | null;
  overall_support_policy: string | null;
  long_term_goal: string | null;
  short_term_goals: string | null;
  goals_json: SupportPlanGoal[];
  raw_generated_text: string | null;
  created_at: string;
  updated_at: string;
};

export async function saveSupportPlan(payload: SupportPlanPayload) {
  const supabase = await createClient();
  const { data: { user }, error: uerr } = await supabase.auth.getUser();
  if (uerr || !user) return { error: "ログインが必要です" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("facility_id")
    .eq("id", user.id)
    .single();
  const facilityId = profile?.facility_id;
  if (!facilityId) return { error: "施設未設定" };

  // client_id を name から逆引き
  let clientId = payload.clientId ?? null;
  if (!clientId) {
    const { data: c } = await supabase
      .from("clients")
      .select("id")
      .eq("facility_id", facilityId)
      .eq("name", payload.clientName)
      .maybeSingle();
    clientId = c?.id ?? null;
  }

  const record = {
    facility_id: facilityId,
    client_id: clientId,
    client_name: payload.clientName,
    plan_version: payload.planVersion ?? 1,
    plan_start_date: payload.planStartDate,
    plan_end_date: payload.planEndDate,
    author_name: payload.authorName ?? null,
    service_manager_name: payload.serviceManagerName ?? null,
    created_date: payload.createdDate ?? null,
    meeting_date: payload.meetingDate ?? null,
    consent_date: payload.consentDate ?? null,
    issued_date: payload.issuedDate ?? null,
    staff_in_charge: payload.staffInCharge ?? null,
    assessment_summary: payload.assessmentSummary ?? null,
    user_needs: payload.userNeeds ?? null,
    family_needs: payload.familyNeeds ?? null,
    attainment_goal: payload.attainmentGoal ?? null,
    overall_support_policy: payload.overallSupportPolicy ?? null,
    long_term_goal: payload.longTermGoal ?? null,
    short_term_goals: payload.shortTermGoals ?? null,
    goals_json: payload.goals,
    raw_generated_text: payload.rawGeneratedText ?? null,
    updated_at: new Date().toISOString(),
  };

  if (payload.id) {
    const { error } = await supabase.from("support_plans").update(record).eq("id", payload.id);
    if (error) return { error: error.message };
    return { success: true, id: payload.id };
  }

  // 新規: 既存の同一利用者の最大 plan_version + 1 を採番
  const { data: maxRow } = await supabase
    .from("support_plans")
    .select("plan_version")
    .eq("facility_id", facilityId)
    .eq("client_name", payload.clientName)
    .order("plan_version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersion = (maxRow?.plan_version ?? 0) + 1;

  const { data: inserted, error } = await supabase
    .from("support_plans")
    .insert({ ...record, plan_version: nextVersion })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { success: true, id: inserted.id };
}

export async function listSupportPlans(opts?: { clientName?: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "ログインが必要です", data: [] as Row[] };

  let q = supabase
    .from("support_plans")
    .select("*")
    .order("plan_start_date", { ascending: false });
  if (opts?.clientName) q = q.eq("client_name", opts.clientName);
  const { data, error } = await q;
  if (error) return { error: error.message, data: [] as Row[] };
  return { error: null, data: (data ?? []) as Row[] };
}

export async function getSupportPlan(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("support_plans")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return { error: error.message, data: null };
  return { error: null, data: data as Row };
}

export async function deleteSupportPlan(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("support_plans").delete().eq("id", id);
  if (error) return { error: error.message };
  return { success: true };
}

export async function getLatestSupportPlanForClient(clientName: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "ログインが必要です", data: null as Row | null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("facility_id")
    .eq("id", user.id)
    .single();
  const facilityId = profile?.facility_id;
  if (!facilityId) return { error: "施設未設定", data: null };

  const { data, error } = await supabase
    .from("support_plans")
    .select("*")
    .eq("facility_id", facilityId)
    .eq("client_name", clientName)
    .order("plan_version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { error: error.message, data: null };
  return { error: null, data: (data ?? null) as Row | null };
}
