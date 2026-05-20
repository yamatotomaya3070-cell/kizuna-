"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AppRole = "admin" | "facility_admin" | "facility";

function normalizeRole(raw: unknown): AppRole {
  if (raw === "admin") return "admin";
  if (raw === "facility_admin") return "facility_admin";
  return "facility";
}

function targetForRole(role: AppRole): string {
  if (role === "admin") return "/admin";
  if (role === "facility_admin") return "/facility/dashboard";
  return "/diary";
}

/**
 * 利用側ログイン（事業所長 / 施設スタッフ）。
 * admin ロールが入ってきた場合はサインアウトさせ、本部入口へ案内する。
 */
export async function loginUser(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "メールアドレスまたはパスワードが正しくありません。" };
  }

  const { data: { user } } = await supabase.auth.getUser();
  const role = normalizeRole(user?.user_metadata?.role);

  if (role === "admin") {
    await supabase.auth.signOut();
    return { error: "このログイン画面は事業所向けです。管理者の方は別の入口をご利用ください。" };
  }

  redirect(targetForRole(role));
}

/**
 * 本部管理者ログイン（/admin-login 専用）。admin 以外は弾く。
 */
export async function loginHeadAdmin(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "メールアドレスまたはパスワードが正しくありません。" };
  }

  const { data: { user } } = await supabase.auth.getUser();
  const role = normalizeRole(user?.user_metadata?.role);

  if (role !== "admin") {
    await supabase.auth.signOut();
    return { error: "本部管理者権限がありません。" };
  }

  redirect("/admin");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
