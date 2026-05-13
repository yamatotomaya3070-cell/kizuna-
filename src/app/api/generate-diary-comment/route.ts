import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

type RequestBody = {
  clientName?: string;
  selectedItems?: string[];
  memo?: string;
  recordedDate?: string;
  attendance?: string;
  roleLabel?: string;
  serviceTypeLabel?: string;
};

function buildFallback(selectedItems: string[] = [], memo = "") {
  const parts = [...selectedItems];
  if (memo.trim()) parts.push(memo.trim());
  if (parts.length === 0) return "本日も落ち着いて過ごされていました。";
  return parts.join("。") + "。";
}

export async function POST(request: Request) {
  let body: RequestBody = {};
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return Response.json({ error: "リクエスト本文が不正です" }, { status: 400 });
  }

  const {
    clientName = "利用者",
    selectedItems = [],
    memo = "",
    recordedDate,
    attendance,
    roleLabel = "支援員",
    serviceTypeLabel = "就労継続支援B型",
  } = body;

  const fallback = buildFallback(selectedItems, memo);

  if (!process.env.GEMINI_API_KEY) {
    return Response.json({ comment: fallback, fallback: true });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const itemsText = selectedItems.length > 0
      ? selectedItems.map((s) => `・${s}`).join("\n")
      : "（選択項目なし）";
    const memoText = memo.trim() ? memo.trim() : "（メモなし）";
    const dateText = recordedDate ?? "";
    const attendanceText = attendance ?? "";

    const prompt = `
あなたは ${serviceTypeLabel} の事業所で日報を書く ${roleLabel} です。
以下の「選択項目」と「メモ」をもとに、行政の実地指導や監査でも違和感のない、
自然で読みやすい日報コメントを 100 文字程度（90〜120 文字）で 1 つだけ作成してください。

【対象利用者】${clientName} さん
【記録日】${dateText}
【出欠】${attendanceText}
【選択項目】
${itemsText}
【メモ】${memoText}

ルール:
- 選択項目をそのまま並べて連結しない。自然な文章に整える
- 敬体（です・ます調）または記録文体に統一する
- 利用者の状態を断定せず、観察された事実を中心に書く
- 差別的・攻撃的・主観の強すぎる表現は避ける
- 「〜と感じた」「〜のように見えた」など、観察ベースの表現を活用する
- 改行や箇条書きは入れず、1〜2 文の通常の文章にする
- 出力は本文の文章のみ。前置きや説明、引用符は付けない
`.trim();

    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();
    const comment = raw.replace(/^["「『]+|["」』]+$/g, "").trim();

    if (!comment) {
      return Response.json({ comment: fallback, fallback: true });
    }
    return Response.json({ comment, fallback: false });
  } catch (error) {
    console.error("generate-diary-comment error:", error);
    return Response.json({ comment: fallback, fallback: true });
  }
}
