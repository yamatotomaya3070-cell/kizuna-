/**
 * 個別支援計画書のAI下書き生成API。
 * 前回計画書（あれば）と対象期間の日報を元に、Geminiで計画書フィールド案を生成して返す。
 *
 * 入力(JSON): { clientName, periodStart, periodEnd }
 * 出力(JSON): {
 *   attainmentGoal, overallSupportPolicy, longTermGoal, shortTermGoal,
 *   goals: [{priority, specific_goal, user_role, support_content, support_duration}, x3],
 *   previousPlan: {plan_version, plan_start_date, plan_end_date} | null,
 *   diaryCount: number,
 *   summary: { goodPoints, issues, conditionChanges, nextPolicy }
 * }
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

type DiaryRow = {
  recorded_at: string;
  recorded_date: string | null;
  attendance: string | null;
  role: string | null;
  ratings: Record<string, unknown> | null;
  comments: Record<string, unknown> | null;
  staff_name: string | null;
};

type SupportPlanGoal = {
  priority: number;
  specific_goal: string;
  user_role: string;
  support_content: string;
  support_duration: string;
};

type AIResult = {
  attainmentGoal: string;
  overallSupportPolicy: string;
  longTermGoal: string;
  shortTermGoal: string;
  goals: SupportPlanGoal[];
  summary: {
    goodPoints: string;
    issues: string;
    conditionChanges: string;
    nextPolicy: string;
  };
};

function buildDiaryDigest(diaries: DiaryRow[]): string {
  if (diaries.length === 0) return "（対象期間の日報記録はありません）";
  return diaries
    .filter((d) => d.attendance !== "●")
    .map((d) => {
      const date = (d.recorded_date ?? d.recorded_at ?? "").slice(0, 10);
      const role = (d.role ?? "work") === "life" ? "生活支援員" : "職業指導員";
      const ratings = d.ratings ?? {};
      const comments = d.comments ?? {};
      const evalText =
        (ratings["eval"] as string | undefined) ??
        (comments["eval"] as string | undefined) ??
        "";
      const condition =
        (ratings["condition"] as string | undefined) ??
        (comments["condition"] as string | undefined) ??
        "";
      const parts = [evalText, condition].filter(Boolean).join(" / ");
      return `${date}（${d.staff_name ?? "?"}・${role}）: ${parts}`;
    })
    .join("\n");
}

export async function POST(request: Request) {
  try {
    const { clientName, periodStart, periodEnd } = await request.json();
    if (!clientName || !periodStart || !periodEnd) {
      return Response.json(
        { error: "clientName / periodStart / periodEnd は必須です" },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "ログインが必要です" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("facility_id")
      .eq("id", user.id)
      .single();
    const facilityId = profile?.facility_id;
    if (!facilityId)
      return Response.json({ error: "施設未設定" }, { status: 400 });

    const { data: prevPlan } = await supabase
      .from("support_plans")
      .select(
        "id, plan_version, plan_start_date, plan_end_date, attainment_goal, overall_support_policy, long_term_goal, short_term_goals, goals_json",
      )
      .eq("facility_id", facilityId)
      .eq("client_name", clientName)
      .lte("plan_end_date", periodEnd)
      .order("plan_version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: diaries } = await supabase
      .from("diaries")
      .select(
        "recorded_at, recorded_date, attendance, role, ratings, comments, staff_name",
      )
      .eq("facility_id", facilityId)
      .eq("client_name", clientName)
      .gte("recorded_at", `${periodStart}T00:00:00`)
      .lte("recorded_at", `${periodEnd}T23:59:59`)
      .order("recorded_at", { ascending: true });

    const diariesArr = (diaries ?? []) as DiaryRow[];
    const digest = buildDiaryDigest(diariesArr);

    const prevPlanBlock = prevPlan
      ? `【前回の個別支援計画書（v${prevPlan.plan_version}: ${prevPlan.plan_start_date} 〜 ${prevPlan.plan_end_date}）】
本人の希望: ${prevPlan.attainment_goal ?? ""}
支援方針: ${prevPlan.overall_support_policy ?? ""}
長期目標: ${prevPlan.long_term_goal ?? ""}
短期目標: ${prevPlan.short_term_goals ?? ""}
3つの目標:
${(Array.isArray(prevPlan.goals_json) ? prevPlan.goals_json : []).map((g: SupportPlanGoal, i: number) => `  ${i + 1}. ${g.specific_goal}（本人の役割: ${g.user_role} / 支援内容: ${g.support_content}）`).join("\n")}`
      : "【前回の個別支援計画書】なし（今回が初回のため、利用者像を日報から推定して下さい）";

    const prompt = `あなたは障がい福祉サービス（就労継続支援B型）のサービス管理責任者です。
以下の「前回の個別支援計画書」と「対象期間の日報・支援記録」をもとに、次期の個別支援計画書の下書き案を作成してください。

利用者氏名: ${clientName}
計画期間: ${periodStart} 〜 ${periodEnd}（半年間）

${prevPlanBlock}

【対象期間の日報・支援記録】
${digest}

以下のJSON形式のみを返してください。説明文・コードブロック記号は不要です。
本人の成長・体調変化・残課題を踏まえ、福祉専門職が書く自然で具体的な日本語にしてください。
目標は前回計画を引き継ぎつつ、達成済みのものは新しい段階へ更新してください。

{
  "attainmentGoal": "本人の希望・到達目標（2〜3文）",
  "overallSupportPolicy": "総合的な支援の方針（2〜3文）",
  "longTermGoal": "長期目標（1文・簡潔に）",
  "shortTermGoal": "短期目標（1文・半年で達成可能な内容）",
  "goals": [
    {"priority":1,"specific_goal":"優先1の具体的到達目標","user_role":"本人の役割","support_content":"支援内容・留意点","support_duration":"6か月\\n開所日"},
    {"priority":2,"specific_goal":"優先2の具体的到達目標","user_role":"本人の役割","support_content":"支援内容・留意点","support_duration":"6か月\\n開所日"},
    {"priority":3,"specific_goal":"優先3の具体的到達目標","user_role":"本人の役割","support_content":"支援内容・留意点","support_duration":"6か月\\n通所日"}
  ],
  "summary": {
    "goodPoints": "できるようになったこと（2〜3文）",
    "issues": "課題として残っていること（2〜3文）",
    "conditionChanges": "体調・精神面の変化（2〜3文）",
    "nextPolicy": "次回の支援方針（2〜3文）"
  }
}`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch)
      return Response.json({ error: "AI応答の解析に失敗しました" }, { status: 500 });

    const ai = JSON.parse(jsonMatch[0]) as AIResult;

    return Response.json({
      ...ai,
      previousPlan: prevPlan
        ? {
            id: prevPlan.id,
            plan_version: prevPlan.plan_version,
            plan_start_date: prevPlan.plan_start_date,
            plan_end_date: prevPlan.plan_end_date,
          }
        : null,
      diaryCount: diariesArr.filter((d) => d.attendance !== "●").length,
    });
  } catch (error) {
    console.error("generate-support-plan error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "生成に失敗しました" },
      { status: 500 },
    );
  }
}
