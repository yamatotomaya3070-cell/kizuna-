import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

const { data: list } = await supabase.auth.admin.listUsers({ perPage: 200 });
const { data: profiles } = await supabase.from("profiles").select("id, role, facility_id");
const profMap = new Map((profiles ?? []).map(p => [p.id, p]));

console.log("\n=== 全ユーザー ===");
for (const u of list.users) {
  const p = profMap.get(u.id);
  console.log(`${u.email}`);
  console.log(`  user_metadata.role: ${u.user_metadata?.role ?? "(未設定)"}`);
  console.log(`  profiles.role     : ${p?.role ?? "(プロフィールなし)"}`);
  console.log(`  facility_id       : ${p?.facility_id ?? "—"}`);
  console.log(`  last_sign_in_at   : ${u.last_sign_in_at ?? "—"}`);
}
