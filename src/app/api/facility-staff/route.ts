import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createSessionClient } from "@/lib/supabase/server";

/**
 * 自施設の施設スタッフ一覧を返す。
 * facility_admin: 自分の facility_id のスタッフのみ
 * admin: クエリパラメータ facilityId で指定（必須）
 */
export async function GET(request: Request) {
  const sessionClient = await createSessionClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) {
    return Response.json({ error: "認証が必要です" }, { status: 401 });
  }
  const callerRole = user.user_metadata?.role ?? "facility";
  if (callerRole !== "admin" && callerRole !== "facility_admin") {
    return Response.json({ error: "権限がありません" }, { status: 403 });
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let facilityId: string | null = null;
  if (callerRole === "admin") {
    const { searchParams } = new URL(request.url);
    facilityId = searchParams.get("facilityId");
    if (!facilityId) return Response.json({ error: "facilityId が必要です" }, { status: 400 });
  } else {
    const { data: profile } = await service
      .from("profiles")
      .select("facility_id")
      .eq("id", user.id)
      .single();
    if (!profile?.facility_id) return Response.json({ error: "所属事業所が未設定です" }, { status: 400 });
    facilityId = profile.facility_id as string;
  }

  // 自施設の facility ロールユーザーを取得
  const { data: profiles, error } = await service
    .from("profiles")
    .select("id, role, created_at")
    .eq("facility_id", facilityId)
    .eq("role", "facility");

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // auth.users からメール取得
  const staff = await Promise.all(
    (profiles ?? []).map(async (p) => {
      const { data } = await service.auth.admin.getUserById(p.id);
      return {
        id: p.id,
        email: data.user?.email ?? "",
        created_at: p.created_at,
      };
    })
  );

  return Response.json({ staff });
}
