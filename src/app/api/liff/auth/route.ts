import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lineUserId = searchParams.get("lineUserId");

  if (!lineUserId) {
    return Response.json({ error: "lineUserId is required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: lineUser } = await supabase
    .from("line_users")
    .select("facility_id, staff_name, role")
    .eq("line_user_id", lineUserId)
    .single();

  if (!lineUser) {
    return Response.json({ error: "not_registered" }, { status: 404 });
  }

  const [{ data: clients }, { data: facility }] = await Promise.all([
    supabase
      .from("clients")
      .select("name")
      .eq("facility_id", lineUser.facility_id)
      .eq("status", "active")
      .order("name"),
    supabase
      .from("facilities")
      .select("name, service_type")
      .eq("id", lineUser.facility_id)
      .single(),
  ]);

  return Response.json({
    staffName: lineUser.staff_name,
    role: lineUser.role,
    facilityId: lineUser.facility_id,
    facilityName: (facility as { name?: string } | null)?.name ?? "",
    serviceType: (facility as { service_type?: string } | null)?.service_type ?? "b_type",
    clients: clients?.map((c) => c.name) ?? [],
  });
}
