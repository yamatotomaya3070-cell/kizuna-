"use server";

import { createClient } from "@/lib/supabase/server";

export type AttendanceRecord = {
  client_name: string;
  attendance: string;
  lunch: string;
  transport: string;          // 行（○ あり / ● なし）
  transport_return: string;   // 帰（○ あり / ● なし）
};

export async function getAttendance(date: string) {
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { error: "ログインが必要です", data: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("facility_id")
    .eq("id", user.id)
    .single();

  const facilityId = profile?.facility_id;
  if (!facilityId) return { error: "施設が設定されていません", data: null };

  const { data, error } = await supabase
    .from("daily_attendance")
    .select("client_name, attendance, lunch, transport, transport_return")
    .eq("facility_id", facilityId)
    .eq("recorded_date", date);

  if (error) return { error: error.message, data: null };
  return { error: null, data: data as AttendanceRecord[] };
}

export async function getAttendanceForClient(clientName: string, date: string) {
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { error: "ログインが必要です", data: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("facility_id")
    .eq("id", user.id)
    .single();

  const facilityId = profile?.facility_id;
  if (!facilityId) return { error: "施設が設定されていません", data: null };

  const { data, error } = await supabase
    .from("daily_attendance")
    .select("client_name, attendance, lunch, transport, transport_return")
    .eq("facility_id", facilityId)
    .eq("client_name", clientName)
    .eq("recorded_date", date)
    .maybeSingle();

  if (error) return { error: error.message, data: null };
  return { error: null, data: data as AttendanceRecord | null };
}

export async function saveAttendance(date: string, records: AttendanceRecord[]) {
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { error: "ログインが必要です" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("facility_id")
    .eq("id", user.id)
    .single();

  const facilityId = profile?.facility_id;
  if (!facilityId) return { error: "施設が設定されていません" };

  const rows = records.map((r) => ({
    facility_id: facilityId,
    client_name: r.client_name,
    recorded_date: date,
    attendance: r.attendance,
    lunch: r.lunch,
    transport: r.transport,
    transport_return: r.transport_return,
    recorded_by: user.id,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("daily_attendance")
    .upsert(rows, { onConflict: "facility_id,client_name,recorded_date" });

  if (error) return { error: error.message };
  return { success: true };
}
