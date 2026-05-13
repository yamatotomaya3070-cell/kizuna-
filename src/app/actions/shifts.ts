"use server";

import { createClient } from "@/lib/supabase/server";

export type ShiftStaff = {
  staffId: string | null;
  name: string;
  role: string;
  shiftType: string | null;
  startTime: string | null;
  endTime: string | null;
};

export type ShiftLookup = {
  date: string;
  staff: ShiftStaff[];
  hasShift: boolean;
  error: string | null;
};

export async function getShiftStaff(date: string): Promise<ShiftLookup> {
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { date, staff: [], hasShift: false, error: "ログインが必要です" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("facility_id")
    .eq("id", user.id)
    .single();

  const facilityId = profile?.facility_id;
  if (!facilityId) {
    return { date, staff: [], hasShift: false, error: "施設が設定されていません" };
  }

  const { data: shifts, error: shiftError } = await supabase
    .from("staff_shifts")
    .select("staff_id, staff_name, role, shift_type, start_time, end_time")
    .eq("facility_id", facilityId)
    .eq("shift_date", date)
    .order("staff_name");

  if (!shiftError && shifts && shifts.length > 0) {
    return {
      date,
      staff: shifts.map((s) => ({
        staffId: s.staff_id ?? null,
        name: s.staff_name,
        role: s.role ?? "work",
        shiftType: s.shift_type ?? null,
        startTime: s.start_time ?? null,
        endTime: s.end_time ?? null,
      })),
      hasShift: true,
      error: null,
    };
  }

  // フォールバック: その日付のシフトが登録されていなければ、アクティブな全職員を返す
  const { data: staffList, error: staffError } = await supabase
    .from("staff")
    .select("id, name, role")
    .eq("facility_id", facilityId)
    .order("name");

  if (staffError) {
    return { date, staff: [], hasShift: false, error: staffError.message };
  }

  return {
    date,
    staff: (staffList ?? []).map((s) => ({
      staffId: s.id,
      name: s.name,
      role: s.role ?? "work",
      shiftType: null,
      startTime: null,
      endTime: null,
    })),
    hasShift: false,
    error: null,
  };
}

export type ShiftImportRow = {
  shiftDate: string;        // YYYY-MM-DD
  staffName: string;
  role?: string | null;
  shiftType?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  facilityName?: string | null;
};

export type ShiftImportResult = {
  success: boolean;
  inserted: number;
  skipped: number;
  errors: string[];
};

export async function importShifts(rows: ShiftImportRow[]): Promise<ShiftImportResult> {
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { success: false, inserted: 0, skipped: 0, errors: ["ログインが必要です"] };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("facility_id")
    .eq("id", user.id)
    .single();

  const facilityId = profile?.facility_id ?? null;
  if (!facilityId) {
    return { success: false, inserted: 0, skipped: 0, errors: ["施設が設定されていません"] };
  }

  // 該当施設の職員を引いて、staff_id 解決用にマップ化
  const { data: staffList } = await supabase
    .from("staff")
    .select("id, name, role")
    .eq("facility_id", facilityId);
  const staffMap = new Map<string, { id: string; role: string }>();
  (staffList ?? []).forEach((s) => staffMap.set(s.name, { id: s.id, role: s.role ?? "work" }));

  const errors: string[] = [];
  const records = rows
    .map((row, idx) => {
      const lineNo = idx + 2; // ヘッダ行を1行目と想定
      if (!row.shiftDate) {
        errors.push(`${lineNo}行目: 日付が空です`);
        return null;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(row.shiftDate)) {
        errors.push(`${lineNo}行目: 日付の形式が不正です (${row.shiftDate})`);
        return null;
      }
      if (!row.staffName) {
        errors.push(`${lineNo}行目: 職員名が空です`);
        return null;
      }
      const staff = staffMap.get(row.staffName);
      return {
        facility_id: facilityId,
        shift_date: row.shiftDate,
        staff_id: staff?.id ?? null,
        staff_name: row.staffName,
        role: row.role || staff?.role || "work",
        shift_type: row.shiftType || null,
        start_time: row.startTime || null,
        end_time: row.endTime || null,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (records.length === 0) {
    return { success: false, inserted: 0, skipped: rows.length, errors };
  }

  const { error, count } = await supabase
    .from("staff_shifts")
    .upsert(records, { onConflict: "facility_id,shift_date,staff_name", count: "exact" });

  if (error) {
    return { success: false, inserted: 0, skipped: rows.length, errors: [...errors, error.message] };
  }

  return {
    success: true,
    inserted: count ?? records.length,
    skipped: rows.length - records.length,
    errors,
  };
}

export async function listShifts(fromDate: string, toDate: string) {
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { error: "ログインが必要です", data: [] };

  const { data: profile } = await supabase
    .from("profiles")
    .select("facility_id")
    .eq("id", user.id)
    .single();

  const facilityId = profile?.facility_id;
  if (!facilityId) return { error: "施設が設定されていません", data: [] };

  const { data, error } = await supabase
    .from("staff_shifts")
    .select("id, shift_date, staff_name, role, shift_type, start_time, end_time")
    .eq("facility_id", facilityId)
    .gte("shift_date", fromDate)
    .lte("shift_date", toDate)
    .order("shift_date")
    .order("staff_name");

  if (error) return { error: error.message, data: [] };
  return { error: null, data };
}

export async function deleteShift(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "ログインが必要です" };
  const { error } = await supabase.from("staff_shifts").delete().eq("id", id);
  if (error) return { error: error.message };
  return { success: true };
}
