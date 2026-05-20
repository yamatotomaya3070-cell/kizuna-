import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// 試しにプロフィールを直接 INSERT してみる（auth.users への紐付けなしでテスト不可なので、
// 代わりに既存ユーザーで profiles に upsert する）
const fakeId = "00000000-0000-0000-0000-000000000099";
const insert = await supabase.from("profiles").insert({ id: fakeId });
console.log("direct insert (FK fail expected):", JSON.stringify(insert, null, 2));

// 制約・トリガーをinformation_schema から確認したいが Supabase の権限的に難しい
// 代わりに既存ユーザーで .update を試す
const upd = await supabase.from("profiles").update({ role: "facility" }).eq("id", "14669762-ade2-4c50-9464-3fc852df6001");
console.log("update sakura role facility:", JSON.stringify(upd, null, 2));

const updBad = await supabase.from("profiles").update({ role: "xxx" }).eq("id", "14669762-ade2-4c50-9464-3fc852df6001");
console.log("update sakura role xxx (CHECK expected):", JSON.stringify(updBad, null, 2));
