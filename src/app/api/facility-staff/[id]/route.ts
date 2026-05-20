import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createSessionClient } from "@/lib/supabase/server";

/**
 * 施設スタッフを削除。
 * facility_admin: 自分の facility_id のスタッフのみ削除可能
 * admin: 任意のスタッフを削除可能
 */
export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  if (!id) return Response.json({ error: "id が必要です" }, { status: 400 });

  const sessionClient = await createSessionClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });

  const callerRole = user.user_metadata?.role ?? "facility";
  if (callerRole !== "admin" && callerRole !== "facility_admin") {
    return Response.json({ error: "権限がありません" }, { status: 403 });
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 対象スタッフの profile を確認
  const { data: targetProfile, error: targetErr } = await service
    .from("profiles")
    .select("facility_id, role")
    .eq("id", id)
    .single();
  if (targetErr || !targetProfile) {
    return Response.json({ error: "対象ユーザーが見つかりません" }, { status: 404 });
  }
  if (targetProfile.role !== "facility") {
    return Response.json({ error: "事業所長や本部管理者は削除できません" }, { status: 400 });
  }

  // facility_admin は自施設のみ
  if (callerRole === "facility_admin") {
    const { data: me } = await service
      .from("profiles")
      .select("facility_id")
      .eq("id", user.id)
      .single();
    if (!me?.facility_id || me.facility_id !== targetProfile.facility_id) {
      return Response.json({ error: "自施設のスタッフのみ削除できます" }, { status: 403 });
    }
  }

  // auth.users から削除 → profiles は ON DELETE CASCADE で消える
  const { error: delErr } = await service.auth.admin.deleteUser(id);
  if (delErr) return Response.json({ error: delErr.message }, { status: 500 });

  return Response.json({ success: true });
}
