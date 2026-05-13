"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "メールアドレスまたはパスワードが正しくありません。" };
  }

  // ロールに応じてリダイレクト
  const { data: { user } } = await supabase.auth.getUser();
  const role = user?.user_metadata?.role ?? "facility";

  const target = role === "admin" ? "/admin" : role === "facility" ? "/diary" : "/";
  redirect(target);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
