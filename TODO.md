# 残タスク（完了したら削除）

## 🔴 必須（これがないと動かない）

- [ ] **adminアカウント作成**
  1. Supabase Dashboard → Authentication → Users → Add user
  2. 作成後にUUIDをコピー
  3. SQL Editor で実行：`UPDATE profiles SET role = 'admin' WHERE id = 'UUID';`

- [ ] **`tasks` テーブルSQL実行**
  - Supabase SQL Editor で `supabase/migrations/20260427_tasks.sql` を実行
  - これで `/dashboard` のタスク管理が動く

- [ ] **Supabase Storage `welfare-docs` バケット作成**
  1. Supabase Dashboard → Storage → New Bucket
  2. 名前: `welfare-docs`、Private に設定
  3. Policies で認証済みユーザーの read/write を許可
  - これで `/documents` の書類アップロードが動く

## 🟡 重要（早めに設定）

- [ ] **Stripe設定**（料金・プランは要相談）
  - Stripe Dashboard で3プラン作成（ライト¥5,000・スタンダード¥12,000・プレミアム¥20,000）
  - 各プランの `price_xxx` IDを取得
  - `.env.local` と Vercel 環境変数に追加：
    ```
    STRIPE_SECRET_KEY=sk_...
    STRIPE_PRICE_LIGHT=price_...
    STRIPE_PRICE_STANDARD=price_...
    STRIPE_PRICE_PREMIUM=price_...
    ```

- [ ] **LINE設定**
  - LINE Developers Console でチャネル作成
  - LIFF アプリ登録（エンドポイント: `https://welfare-manager-app.vercel.app/liff/diary`）
  - Webhook URL: `https://welfare-manager-app.vercel.app/api/line-webhook`
  - `.env.local` と Vercel 環境変数に追加：
    ```
    LINE_CHANNEL_ACCESS_TOKEN=...
    LINE_CHANNEL_SECRET=...
    NEXT_PUBLIC_LIFF_ID=...
    ```

## 🟢 任意（後回し可）

- [ ] **Resend（メール通知）設定**
  - Resend でAPIキー取得
  - `RESEND_API_KEY` を `.env.local` と Vercel に追加

- [ ] **料金プラン確定**（Stripeと連動）
  - 現在のプラン: ライト¥5,000 / スタンダード¥12,000 / プレミアム¥20,000
  - 要相談して金額・内容を決定

---

## ✅ 完了済み

- Vercel デプロイ
- Supabase セットアップ（URL・Anon Key・Service Role Key）
- マイグレーション実行（00_base_schema 〜 20260427_line_users）
- 全環境変数設定（Supabase 3つ・Gemini・APP_URL）
- モックデータ → Supabase 実データに差し替え（admin・dashboard・documents）
- 戻るボタン修正（router.back()）
- adminルート保護ミドルウェア追加
