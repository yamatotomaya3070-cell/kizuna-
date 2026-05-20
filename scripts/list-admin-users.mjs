/**
 * 現在の admin ロールユーザーを一覧表示する。
 *
 * 使い方:
 *   $env:NEXT_PUBLIC_SUPABASE_URL = "https://xxx.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY = "eyJ..."
 *   node scripts/list-admin-users.mjs
 *
 * パスワードは Supabase に保存されない（ハッシュのみ）ため表示できません。
 * 不明な場合は scripts/reset-admin-password.mjs でリセットしてください。
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("環境変数 NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が必要です。");
  process.exit(1);
}

const supabase = createClient(url, key);

const { data: list, error } = await supabase.auth.admin.listUsers({ perPage: 200 });
if (error) {
  console.error("listUsers 失敗:", error.message);
  process.exit(1);
}

// user_metadata.role が admin のユーザー
const admins = list.users.filter((u) => u.user_metadata?.role === "admin");

// profiles.role も照らし合わせる
const { data: profiles } = await supabase
  .from("profiles")
  .select("id, role")
  .eq("role", "admin");
const profileAdmins = new Set((profiles ?? []).map((p) => p.id));

console.log("\n=== 本部管理者(admin)ユーザー一覧 ===");
if (admins.length === 0 && profileAdmins.size === 0) {
  console.log("（該当ユーザーなし）");
} else {
  const union = new Set([...admins.map((u) => u.id), ...profileAdmins]);
  for (const id of union) {
    const u = list.users.find((x) => x.id === id);
    const inMeta = u?.user_metadata?.role === "admin";
    const inProf = profileAdmins.has(id);
    console.log(`- ${u?.email ?? "(unknown)"}`);
    console.log(`    id              : ${id}`);
    console.log(`    user_metadata   : ${inMeta ? "admin ✓" : "未設定 ✗"}`);
    console.log(`    profiles.role   : ${inProf ? "admin ✓" : "未設定 ✗"}`);
    console.log(`    last_sign_in_at : ${u?.last_sign_in_at ?? "—"}`);
    console.log(`    created_at      : ${u?.created_at ?? "—"}`);
    console.log("");
  }
}
console.log("※パスワードはハッシュ保存のため取得できません。不明ならリセットスクリプトを使ってください。");
