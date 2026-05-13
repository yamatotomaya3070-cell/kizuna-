"use server";

import { createClient } from "@/lib/supabase/server";

export type ShiftStaff = {
  staffId: string | null;
  name: string;
  role: string;
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
    .select("staff_id, staff_name, role")
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
    })),
    hasShift: false,
    error: null,
  };
}
