"use server";

import { createClient } from "@/lib/supabase/server";

type DiaryPayload = {
  clientName: string;
  staffName: string;
  attendance: string;
  breakfast: string;
  sleep: string;
  ratings: Record<string, unknown>;
  comments: Record<string, unknown>;
  recordedDate?: string; // YYYY-MM-DD（日報対象日）。未指定なら今日
  role?: string;         // 'work' | 'life' | 'shift' など。未指定なら 'work'
};

function todayJa(): string {
  // ローカル（Asia/Tokyo 想定）の YYYY-MM-DD
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function saveDiary(payload: DiaryPayload) {
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { error: "ログインが必要です" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("facility_id")
    .eq("id", user.id)
    .single();

  const facilityId = profile?.facility_id ?? null;
  const recordedDate = payload.recordedDate ?? todayJa();

  // daily_attendance に既入力データがあればそちらを優先
  let attendance = payload.attendance;
  let breakfast = payload.breakfast;
  let sleep = payload.sleep;

  if (facilityId) {
    const { data: da } = await supabase
      .from("daily_attendance")
      .select("attendance, lunch, transport")
      .eq("facility_id", facilityId)
      .eq("client_name", payload.clientName)
      .eq("recorded_date", recordedDate)
      .maybeSingle();

    if (da) {
      attendance = da.attendance;
      breakfast = da.lunch;
      sleep = da.transport;
    }
  }

  const { error } = await supabase.from("diaries").insert({
    staff_id: user.id,
    facility_id: facilityId,
    client_name: payload.clientName,
    staff_name: payload.staffName,
    attendance,
    breakfast,
    sleep,
    role: payload.role ?? (payload.comments?.role as string | undefined) ?? "work",
    ratings: payload.ratings,
    comments: payload.comments,
    recorded_date: recordedDate,
    recorded_at: new Date().toISOString(),
  });

  if (error) return { error: error.message };
  return { success: true };
}

type BatchEntry = {
  clientName: string;
  comment: string;
};

export async function saveDiaryBatch(
  staffName: string,
  role: "work" | "life",
  entries: BatchEntry[]
) {
  if (entries.length === 0) return { success: true, count: 0 };

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { error: "ログインが必要です" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("facility_id")
    .eq("id", user.id)
    .single();

  const facilityId = profile?.facility_id ?? null;
  const today = todayJa();

  const attendanceMap = new Map<string, { attendance: string; lunch: string; transport: string }>();
  if (facilityId) {
    const { data: da } = await supabase
      .from("daily_attendance")
      .select("client_name, attendance, lunch, transport")
      .eq("facility_id", facilityId)
      .eq("recorded_date", today);
    (da ?? []).forEach((r) => attendanceMap.set(r.client_name, r));
  }

  const now = new Date().toISOString();
  const rows = entries.map((entry) => {
    const da = attendanceMap.get(entry.clientName);
    const isAbsent = da?.attendance === "●";
    return {
      staff_id: user.id,
      facility_id: facilityId,
      client_name: entry.clientName,
      staff_name: staffName,
      attendance: da?.attendance ?? "○",
      breakfast: da?.lunch ?? (isAbsent ? "●" : "○"),
      sleep: da?.transport ?? (isAbsent ? "●" : "○"),
      role,
      ratings: {
        eval: isAbsent ? "" : entry.comment,
        finalComment: isAbsent ? "" : entry.comment,
      },
      comments: { role },
      recorded_date: today,
      recorded_at: now,
    };
  });

  const { error } = await supabase.from("diaries").insert(rows);
  if (error) return { error: error.message };
  return { success: true, count: rows.length };
}
