/**
 * 既存ユーザーを facility_admin に昇格させるスクリプト。
 *
 * 使い方:
 *   node scripts/promote-facility-admin.mjs <email>
 *
 * 動作:
 *   1) auth.users から email でユーザーを検索
 *   2) user_metadata.role を 'facility_admin' に更新
 *   3) profiles.role を 'facility_admin' に更新
 *
 * 必要な環境変数:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * 例:
 *   $env:NEXT_PUBLIC_SUPABASE_URL = "https://xxx.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY = "eyJ..."
 *   node scripts/promote-facility-admin.mjs sakura@example.com
 */

import { createClient } from "@supabase/supabase-js";

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/promote-facility-admin.mjs <email>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("環境変数 NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が必要です。");
  process.exit(1);
}

const supabase = createClient(url, key);

// ユーザーをメールで検索（listUsers は pagination が必要だが、規模が小さい間はこれで十分）
const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 200 });
if (listErr) {
  console.error("listUsers 失敗:", listErr.message);
  process.exit(1);
}

const target = list.users.find((u) => u.email === email);
if (!target) {
  console.error(`ユーザーが見つかりません: ${email}`);
  process.exit(1);
}

// user_metadata 更新
const { error: metaErr } = await supabase.auth.admin.updateUserById(target.id, {
  user_metadata: { ...target.user_metadata, role: "facility_admin" },
});
if (metaErr) {
  console.error("user_metadata 更新失敗:", metaErr.message);
  process.exit(1);
}

// profiles 更新
const { error: profErr } = await supabase
  .from("profiles")
  .update({ role: "facility_admin" })
  .eq("id", target.id);
if (profErr) {
  console.error("profiles 更新失敗:", profErr.message);
  process.exit(1);
}

console.log(`✓ ${email} (${target.id}) を facility_admin に昇格しました。`);
