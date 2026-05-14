import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildDiaryExcel, type DiaryRowInput } from "@/lib/excel/diary-export";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DiaryRow = {
  client_name: string;
  attendance: string;
  breakfast: string;
  sleep: string;
  ratings: Record<string, unknown> | null;
  comments: Record<string, unknown> | null;
  staff_name: string | null;
};

type AttendanceRow = {
  client_name: string;
  attendance: string;
  lunch: string;
  transport: string;
  transport_return: string;
};

// チップ文言 ⇔ work/life 区分
const WORK_LABELS = new Set([
  "積極的に取り組んでおられていた",
  "安定して取り組まれていた",
  "作業に集中しておられなかった",
  "作業意欲を感じなかった",
]);
const LIFE_LABELS = new Set([
  "安定してすごされていた",
  "落ち着いてすごされていた",
  "情緒的に不安定なご様子です",
  "いらいらとされていた",
]);

function buildFallback(chips: string[]): string {
  if (chips.length === 0) return "";
  return chips.join("。") + "。";
}

async function summarize(
  model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]> | null,
  clientName: string,
  side: "職業指導員" | "生活支援員",
  chips: string[],
): Promise<string> {
  const fallback = buildFallback(chips);
  if (chips.length === 0) return "";
  if (!model) return fallback;
  try {
    const prompt = `
あなたは就労継続支援B型の事業所で日報を書く${side}です。
以下の観察項目を、行政の実地指導でも違和感のない丁寧語（です・ます調）で、
60〜80文字の1〜2文に要約してください。
箇条書きや引用符は使わず、本文だけを出力してください。

【利用者】${clientName} さん
【観察項目】
${chips.map((s) => `・${s}`).join("\n")}
`.trim();
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();
    const cleaned = raw.replace(/^["「『]+|["」』]+$/g, "").trim();
    return cleaned || fallback;
  } catch {
    return fallback;
  }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Response("invalid date", { status: 400 });
  }

  const { data: profile } = await supabase.from("profiles").select("facility_id").eq("id", user.id).single();
  const facilityId = profile?.facility_id;
  if (!facilityId) return new Response("施設未設定", { status: 400 });

  const { data: clientsData } = await supabase
    .from("clients")
    .select("name")
    .eq("facility_id", facilityId)
    .order("name");
  const clientNames = (clientsData ?? []).map((c) => c.name);

  const { data: attendances } = await supabase
    .from("daily_attendance")
    .select("client_name, attendance, lunch, transport, transport_return")
    .eq("facility_id", facilityId)
    .eq("recorded_date", date);
  const attMap = new Map<string, AttendanceRow>();
  ((attendances ?? []) as AttendanceRow[]).forEach((a) => attMap.set(a.client_name, a));

  const { data: diaries } = await supabase
    .from("diaries")
    .select("client_name, attendance, breakfast, sleep, ratings, comments, staff_name")
    .eq("facility_id", facilityId)
    .eq("recorded_date", date);
  const diaryMap = new Map<string, DiaryRow>();
  ((diaries ?? []) as DiaryRow[]).forEach((d) => diaryMap.set(d.client_name, d));

  const apiKey = process.env.GEMINI_API_KEY;
  const model = apiKey
    ? new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: "gemini-2.5-flash" })
    : null;

  // 利用者ごとに行を組み立て（並列でAI要約）
  const rows: DiaryRowInput[] = await Promise.all(
    clientNames.map(async (name, i) => {
      const att = attMap.get(name);
      const diary = diaryMap.get(name);
      const ratings = (diary?.ratings ?? {}) as Record<string, unknown>;
      const finalComment = String(ratings.finalComment ?? ratings.eval ?? "");
      const selectedItems = Array.isArray(ratings.selectedItems) ? (ratings.selectedItems as string[]) : [];
      const workChips = selectedItems.filter((s) => WORK_LABELS.has(s));
      const lifeChips = selectedItems.filter((s) => LIFE_LABELS.has(s));

      const [workStatus, lifeStatus] = await Promise.all([
        summarize(model, name, "職業指導員", workChips),
        summarize(model, name, "生活支援員", lifeChips),
      ]);

      const isAbsent = (att?.attendance ?? diary?.attendance ?? "") === "●";
      return {
        no: i + 1,
        clientName: name,
        attendance: att?.attendance ?? diary?.attendance ?? "",
        lunch: att?.lunch ?? diary?.breakfast ?? "",
        transportGo: att?.transport ?? "",
        transportReturn: att?.transport_return ?? "",
        workStatus: isAbsent ? "" : workStatus,
        workComment: isAbsent ? "" : finalComment,
        lifeStatus: isAbsent ? "" : lifeStatus,
        lifeComment: isAbsent ? "" : finalComment,
      };
    }),
  );

  const { data: shifts } = await supabase
    .from("staff_shifts")
    .select("staff_name")
    .eq("facility_id", facilityId)
    .eq("shift_date", date);
  const staffNames = (shifts ?? []).map((s) => s.staff_name).join("、");

  const { buffer, filename } = await buildDiaryExcel({
    date,
    rows,
    staffInCharge: staffNames || undefined,
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
