/**
 * 指定ユーザーのパスワードをリセットする（Supabase Admin API 使用）。
 *
 * 使い方:
 *   node scripts/reset-admin-password.mjs <email> [新パスワード]
 *
 * 新パスワードを省略した場合はランダムな16文字を生成して表示します。
 *
 * 必要な環境変数（未設定なら .env.local から自動読込）:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * 例:
 *   node scripts/reset-admin-password.mjs admin@example.com
 *   node scripts/reset-admin-password.mjs admin@example.com MyNewPass123!
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

// .env.local から不足分を補完（依存パッケージなしの簡易ローダー）
function loadEnvLocal() {
  let text;
  try {
    text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  } catch {
    return;
  }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_0-9]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim();
    }
  }
}
loadEnvLocal();

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/reset-admin-password.mjs <email> [新パスワード]");
  process.exit(1);
}

const PASSWORD_LENGTH = 16;
const newPassword =
  process.argv[3] ?? randomBytes(24).toString("base64url").slice(0, PASSWORD_LENGTH);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("環境変数 NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が必要です。");
  process.exit(1);
}

const supabase = createClient(url, key);

const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 200 });
if (listErr) {
  console.error("listUsers 失敗:", listErr.message);
  console.error("※ 'fetch failed' の場合は Supabase プロジェクトが一時停止中の可能性があります。");
  console.error("   https://supabase.com/dashboard でプロジェクトを Restore してください。");
  process.exit(1);
}

const target = list.users.find((u) => u.email === email);
if (!target) {
  console.error(`ユーザーが見つかりません: ${email}`);
  console.error("登録済みユーザー一覧:");
  for (const u of list.users) console.error(`  - ${u.email}`);
  process.exit(1);
}

const { error: updateErr } = await supabase.auth.admin.updateUserById(target.id, {
  password: newPassword,
});
if (updateErr) {
  console.error("パスワード更新失敗:", updateErr.message);
  process.exit(1);
}

console.log(`✓ パスワードをリセットしました。`);
console.log(`  ログインID（メール）: ${email}`);
console.log(`  新パスワード        : ${newPassword}`);
console.log(`  ロール              : ${target.user_metadata?.role ?? "(未設定)"}`);
console.log("");
console.log("※ この画面に表示されたパスワードは安全な場所に保管し、初回ログイン後に変更してください。");
