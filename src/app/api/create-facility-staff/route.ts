import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createSessionClient } from "@/lib/supabase/server";

/**
 * 事業所長（または本部管理者）が自施設の施設スタッフアカウントを発行する。
 * - facility_admin: 自分の facility_id に紐づくスタッフのみ作成可能
 * - admin: 任意の facility_id を指定可能
 */
export async function POST(request: Request) {
  const sessionClient = await createSessionClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) {
    return Response.json({ error: "認証が必要です" }, { status: 401 });
  }

  const callerRole = user.user_metadata?.role ?? "facility";
  if (callerRole !== "admin" && callerRole !== "facility_admin") {
    return Response.json({ error: "事業所長または本部管理者のみ実行できます" }, { status: 403 });
  }

  const body = await request.json();
  const { email, password } = body;
  if (!email || !password) {
    return Response.json({ error: "メールとパスワードを入力してください" }, { status: 400 });
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 紐付ける facility_id を決定
  let facilityId: string | null = null;
  if (callerRole === "admin") {
    facilityId = body.facilityId ?? null;
    if (!facilityId) {
      return Response.json({ error: "facilityId が必要です" }, { status: 400 });
    }
  } else {
    // facility_admin は自分の facility_id を強制（リクエストの値は無視）
    const { data: profile, error } = await service
      .from("profiles")
      .select("facility_id")
      .eq("id", user.id)
      .single();
    console.log("[create-facility-staff] user.id:", user.id, "profile:", profile, "error:", error?.message);
    if (error || !profile?.facility_id) {
      return Response.json({
        error: "所属事業所が設定されていません",
        _debug: { userId: user.id, profileError: error?.message ?? null, profileFacilityId: profile?.facility_id ?? null },
      }, { status: 400 });
    }
    facilityId = profile.facility_id as string;
  }

  try {
    const { data: created, error: userError } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "facility" },
    });
    if (userError || !created.user) {
      throw new Error(`ユーザー作成失敗: ${userError?.message ?? "unknown"}`);
    }

    const { error: profileError } = await service
      .from("profiles")
      .upsert({
        id: created.user.id,
        facility_id: facilityId,
        role: "facility",
      });
    if (profileError) {
      // 補正：作ったユーザーを削除して整合性を保つ
      await service.auth.admin.deleteUser(created.user.id);
      throw new Error(`プロフィール紐付け失敗: ${profileError.message}`);
    }

    return Response.json({ success: true, userId: created.user.id, facilityId });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "作成に失敗しました";
    return Response.json({ error: msg }, { status: 500 });
  }
}
