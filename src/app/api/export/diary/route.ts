import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildDiaryExcel, type DiaryRowInput } from "@/lib/excel/diary-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DiaryRow = {
  client_name: string;
  attendance: string;
  breakfast: string;
  sleep: string;
  ratings: Record<string, unknown> | null;
  comments: Record<string, unknown> | null;
  staff_name: string | null;
};

type AttendanceRow = {
  client_name: string;
  attendance: string;
  lunch: string;
  transport: string;
};

const WORK_EVAL_KEYS = ["active_engagement", "stable_engagement", "not_focused", "no_motivation"] as const;
const LIFE_EVAL_KEYS = ["stable_passing", "calm_passing", "emotionally_unstable", "irritated"] as const;

const WORK_EVAL_LABELS: Record<typeof WORK_EVAL_KEYS[number], string[]> = {
  active_engagement: ["積極的", "意欲的"],
  stable_engagement: ["安定して取り組ま", "落ち着いて作業", "集中して作業"],
  not_focused: ["集中しておられなかった", "集中が続か"],
  no_motivation: ["意欲を感じなかった", "意欲が"],
};
const LIFE_EVAL_LABELS: Record<typeof LIFE_EVAL_KEYS[number], string[]> = {
  stable_passing: ["安定してすごされ", "安定して過ごされ"],
  calm_passing: ["落ち着いてすごされ", "落ち着いて過ごされ", "穏やか"],
  emotionally_unstable: ["情緒的に不安定", "不安定な様子"],
  irritated: ["いらいら"],
};

function inferEvalFromText(text: string, labels: Record<string, string[]>): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const [key, needles] of Object.entries(labels)) {
    out[key] = needles.some((n) => text.includes(n));
  }
  return out;
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Response("invalid date", { status: 400 });
  }

  const { data: profile } = await supabase.from("profiles").select("facility_id").eq("id", user.id).single();
  const facilityId = profile?.facility_id;
  if (!facilityId) return new Response("施設未設定", { status: 400 });

  // 利用者マスタ
  const { data: clientsData } = await supabase
    .from("clients")
    .select("name")
    .eq("facility_id", facilityId)
    .order("name");
  const clientNames = (clientsData ?? []).map((c) => c.name);

  // 当日の出欠
  const { data: attendances } = await supabase
    .from("daily_attendance")
    .select("client_name, attendance, lunch, transport")
    .eq("facility_id", facilityId)
    .eq("recorded_date", date);
  const attMap = new Map<string, AttendanceRow>();
  ((attendances ?? []) as AttendanceRow[]).forEach((a) => attMap.set(a.client_name, a));

  // 当日の日報
  const { data: diaries } = await supabase
    .from("diaries")
    .select("client_name, attendance, breakfast, sleep, ratings, comments, staff_name")
    .eq("facility_id", facilityId)
    .eq("recorded_date", date);
  const diaryMap = new Map<string, DiaryRow>();
  ((diaries ?? []) as DiaryRow[]).forEach((d) => diaryMap.set(d.client_name, d));

  // 利用者ごとに行を組み立て（マスタ順を維持）
  const rows: DiaryRowInput[] = clientNames.map((name, i) => {
    const att = attMap.get(name);
    const diary = diaryMap.get(name);
    const ratings = (diary?.ratings ?? {}) as Record<string, unknown>;
    const finalComment = String(ratings.finalComment ?? ratings.eval ?? "");
    const selectedItems = Array.isArray(ratings.selectedItems) ? (ratings.selectedItems as string[]).join("。") : "";
    const text = `${selectedItems}\n${finalComment}`;
    const workEval = inferEvalFromText(text, WORK_EVAL_LABELS as unknown as Record<string, string[]>);
    const lifeEval = inferEvalFromText(text, LIFE_EVAL_LABELS as unknown as Record<string, string[]>);
    return {
      no: i + 1,
      clientName: name,
      attendance: att?.attendance ?? diary?.attendance ?? "",
      lunch: att?.lunch ?? diary?.breakfast ?? "",
      transport: att?.transport ?? diary?.sleep ?? "",
      workEval,
      lifeEval,
      remarks: finalComment || undefined,
    };
  });

  // 担当者（その日のシフト）
  const { data: shifts } = await supabase
    .from("staff_shifts")
    .select("staff_name")
    .eq("facility_id", facilityId)
    .eq("shift_date", date);
  const staffNames = (shifts ?? []).map((s) => s.staff_name).join("、");

  // 備考：1日の代表コメント（最初の利用者の最終コメントは含めない方が無難）
  const facilityRemarks = "";

  const { buffer, filename } = await buildDiaryExcel({
    date,
    rows,
    staffInCharge: staffNames || undefined,
    facilityRemarks,
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
