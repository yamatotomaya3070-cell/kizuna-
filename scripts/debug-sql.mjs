// Supabase Management API 経由で SQL を実行する（service_role でPostgrest経由は無理なので、
// 代わりに postgrest の rpc を試す。functionが無ければエラー）
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// 直接 SQL は無理なので、profilesのstructureをBANGテスト
// 全カラム明示 insert を試す（NOT NULL のカラムがあるか確認）
const fakeUuid = "00000000-0000-0000-0000-000000000098";

// id, facility_id, role, created_at を明示
const ins = await supabase.from("profiles").insert({ id: fakeUuid, role: "facility" });
console.log("explicit insert (FK fail expected):", JSON.stringify(ins, null, 2));
