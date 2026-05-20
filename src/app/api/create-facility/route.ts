import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createSessionClient } from "@/lib/supabase/server";

/**
 * 本部管理者のみが事業所＋事業所長アカウントを発行できる。
 * 発行されるユーザーの role は facility_admin。
 */
export async function POST(request: Request) {
  // 呼び出し元のロールを検証
  const sessionClient = await createSessionClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) {
    return Response.json({ error: "認証が必要です" }, { status: 401 });
  }
  const callerRole = user.user_metadata?.role ?? "facility";
  if (callerRole !== "admin") {
    return Response.json({ error: "本部管理者のみ実行できます" }, { status: 403 });
  }

  const { facilityName, serviceType, email, password } = await request.json();

  if (!facilityName || !email || !password) {
    return Response.json({ error: "全項目を入力してください" }, { status: 400 });
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // ① 事業所を作成
    const { data: facility, error: facilityError } = await supabase
      .from("facilities")
      .insert({ name: facilityName, service_type: serviceType ?? "b_type" })
      .select()
      .single();

    if (facilityError) throw new Error(`事業所作成失敗: ${facilityError.message}`);

    // ② 事業所長アカウントを作成
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "facility_admin" },
    });

    if (userError) {
      await supabase.from("facilities").delete().eq("id", facility.id);
      throw new Error(`ユーザー作成失敗: ${userError.message}`);
    }

    // ③ profiles に紐付け（事業所長）
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({
        id: userData.user.id,
        facility_id: facility.id,
        role: "facility_admin",
      });

    if (profileError) throw new Error(`プロフィール紐付け失敗: ${profileError.message}`);

    return Response.json({ success: true, facilityId: facility.id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "作成に失敗しました";
    return Response.json({ error: msg }, { status: 500 });
  }
}
