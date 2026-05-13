import Stripe from "stripe";

export async function POST(request: Request) {
  try {
    const { plan, facilityName } = await request.json();
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const PLANS: Record<string, string | undefined> = {
      light: process.env.STRIPE_PRICE_LIGHT,
      standard: process.env.STRIPE_PRICE_STANDARD,
      premium: process.env.STRIPE_PRICE_PREMIUM,
    };

    const priceId = PLANS[plan];
    if (!priceId) {
      return Response.json({ error: "このプランの priceId が設定されていません" }, { status: 400 });
    }
    if (!secretKey || !appUrl) {
      return Response.json(
        {
          error: "現在、課金機能は準備中です。デモ環境のため、実際の決済は行われません。",
          demo: true,
        },
        { status: 503 }
      );
    }

    const stripe = new Stripe(secretKey, {
      apiVersion: "2026-03-25.dahlia",
    });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { facilityName, plan },
      success_url: `${appUrl}/billing/success?plan=${encodeURIComponent(plan)}`,
      cancel_url: `${appUrl}/billing?canceled=1`,
    });

    if (!session.url) {
      return Response.json({ error: "Checkout URLを取得できませんでした" }, { status: 500 });
    }
    return Response.json({ url: session.url });
  } catch (error) {
    console.error("Stripe エラー:", error);
    return Response.json({ error: "決済セッションの作成に失敗しました" }, { status: 500 });
  }
}
