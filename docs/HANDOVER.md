# 開発引き継ぎドキュメント（welfare-manager-app）

新しく開発を引き継ぐ方へ。このドキュメントに沿えば開発環境の構築から運用までを引き継げます。
**Claude Code を使っている場合は、末尾の「新担当者向け: Claude Code 用プロンプト」をそのまま貼り付けてください。**

---

## 1. プロジェクト概要

- **内容:** 障害福祉事業所向け管理 SaaS（合同会社絆）
- **本番URL:** https://welfare-manager-app.vercel.app
- **リポジトリ:** https://github.com/yamatotomaya3070-cell/kizuna-
- **操作マニュアル:** [docs/admin-manual.md](./admin-manual.md)

### 技術スタック

| 領域 | 技術 |
|------|------|
| フレームワーク | Next.js 16 (App Router) + React 19 + TypeScript |
| スタイリング | Tailwind CSS v4 |
| DB / 認証 | Supabase（Auth + Postgres + RLS） |
| ホスティング | Vercel |
| AI 生成（日誌コメント・支援計画・モニタリング） | Google Gemini API |
| LINE 連携（日誌入力・通知） | LINE Messaging API + LIFF |
| 決済 | Stripe |
| メール送信 | Resend |

### ロール構成（Supabase Auth: メール + パスワード）

| ロール | 用途 | ログインURL | ログイン後 |
|--------|------|-------------|------------|
| `admin` | 本部管理者（SaaS運営） | `/admin-login`（非公開URL） | `/admin` |
| `facility_admin` | 事業所長 | `/login` | `/facility/dashboard` |
| `facility` | 施設スタッフ | `/login` | `/diary` |

ロールは `auth.users.user_metadata.role` と `profiles.role` の両方で管理。ずれた場合の直し方は admin-manual.md の FAQ 参照。

---

## 2. 引き継ぎチェックリスト（前任者 → 新担当者）

### アカウント・アクセス権の移管

- [ ] **GitHub** リポジトリ `yamatotomaya3070-cell/kizuna-` — コラボレーター招待 or リポジトリ移管（Settings → Collaborators / Transfer ownership）
- [ ] **Supabase** プロジェクト（ref: `slvpuldjlvbomfcolrqu`） — Dashboard → Organization → Team から招待、または Project Settings → Transfer project で移管
- [ ] **Vercel** プロジェクト `welfare-manager-app` — Hobby プランはメンバー招待不可のため、新担当者の Vercel アカウントで GitHub リポジトリを再インポートし、環境変数を設定し直すのが現実的（※その場合 `welfare-manager-app.vercel.app` の URL は変わる可能性あり）
- [ ] **Google AI Studio**（Gemini API キー） — 新担当者が自分のキーを発行して差し替え
- [ ] **LINE Developers**（Messaging API チャネル + LIFF） — チャネル管理者に新担当者を追加（LINE Developers Console → チャネル → 権限管理）
- [ ] **Stripe** アカウント — チームメンバー招待 or 新アカウントでキー差し替え（Price ID 3種も再作成）
- [ ] **Resend** アカウント — 同上

### 秘密情報の受け渡し

- [ ] `.env.local` を**安全な経路**（パスワード付きZIP、1Password共有、直接手渡し等）で受け渡す。**絶対に git にコミットしたりメール平文で送らない**
- [ ] Vercel に設定済みの環境変数一覧を確認（`vercel env ls` またはダッシュボード）— `.env.local` に無い LINE / Stripe / Resend 系のキーは Vercel 側にのみ存在する可能性あり
- [ ] **引き継ぎ完了後、全キーをローテーション**（前任者の手元にキーが残るため）:
  - Supabase: Project Settings → API → Reset service_role key
  - Gemini / Stripe / Resend / LINE: 各ダッシュボードで再発行

### 動作確認

- [ ] `npm install` → `npm run dev` でローカル起動
- [ ] http://localhost:3000/login が表示される
- [ ] 管理者アカウントでログインできる（不明なら後述のリセットスクリプト）

---

## 3. 環境変数一覧

`.env.local`（ローカル開発用）と Vercel（本番用）の両方に設定する。

| 変数名 | 用途 | 必須 |
|--------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクトURL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名キー（公開可） | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 管理キー（**秘密**） | ✅ |
| `GEMINI_API_KEY` | Gemini API（AI生成機能） | AI機能使用時 |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Messaging API | LINE連携時 |
| `LINE_CHANNEL_SECRET` | LINE Webhook 署名検証 | LINE連携時 |
| `NEXT_PUBLIC_LIFF_ID` | LIFF アプリID | LINE連携時 |
| `NEXT_PUBLIC_APP_URL` | アプリの公開URL | LINE連携時 |
| `STRIPE_SECRET_KEY` | Stripe 秘密キー | 決済使用時 |
| `STRIPE_PRICE_LIGHT` / `STRIPE_PRICE_STANDARD` / `STRIPE_PRICE_PREMIUM` | Stripe Price ID（3プラン） | 決済使用時 |
| `RESEND_API_KEY` | Resend メール送信 | メール使用時 |
| `DISABLE_ADMIN_LOGIN` | `true` で `/admin-login` を404化 | 任意 |

---

## 4. セットアップ手順

```bash
git clone https://github.com/yamatotomaya3070-cell/kizuna-.git welfare-manager-app
cd welfare-manager-app
# 前任者から受け取った .env.local をプロジェクト直下に配置
npm install
npm run dev
# → http://localhost:3000
```

---

## 5. ⚠️ Supabase 無料プランの自動一時停止について

**このプロジェクト最大の運用上の注意点。**

Supabase 無料プランは **約1週間アクセスがないとプロジェクトが自動停止（pause）** され、DNS ごと消えるため、アプリ全体（本番含む）が動かなくなります。

**症状:** `xxx.supabase.co` が名前解決できない / アプリで「fetch failed」

**復旧方法:**
1. https://supabase.com/dashboard にログイン
2. 対象プロジェクトを開く → 「Restore project」をクリック
3. 数分待つと復旧（データは保持されている）

**恒久対策:** 本運用するなら Pro プラン（$25/月）への移行を推奨。

---

## 6. 運用スクリプト（`scripts/`）

いずれも `.env.local` の値を環境変数に設定して実行（`reset-admin-password.mjs` は自動読込対応）。

| スクリプト | 用途 |
|-----------|------|
| `list-admin-users.mjs` | 本部管理者（admin）ユーザーの一覧表示 |
| `reset-admin-password.mjs` | 任意ユーザーのパスワードリセット（ID・パスワード忘れ時） |
| `promote-facility-admin.mjs` | 既存ユーザーを facility_admin に昇格 |
| `debug-*.mjs` | 各種デバッグ用 |

### ログインできなくなったときの復旧手順

```bash
# 1. Supabase が停止していれば先に Restore（上記 §5）
# 2. 登録ユーザーとメールアドレスを確認
node scripts/reset-admin-password.mjs dummy@dummy.com   # 見つからない場合、全ユーザー一覧が表示される
# 3. 対象メールでリセット（新パスワード自動生成）
node scripts/reset-admin-password.mjs <確認したメールアドレス>
```

パスワードは Supabase にハッシュのみ保存されるため「思い出す」ことはできず、リセットが唯一の手段。

---

## 7. データベース

- スキーマは `supabase/migrations/` に SQL として管理（`00_base_schema.sql` がベース）
- 適用は Supabase Dashboard の SQL Editor に貼り付けて実行する運用
- 新規ユーザー作成時は `handle_new_user` トリガーが `profiles` 行を自動作成（直近で修正済み: `20260520_fix_handle_new_user.sql`）

---

## 8. 新担当者向け: Claude Code 用プロンプト

以下をそのまま Claude Code に貼り付ければ、セットアップと動作確認が自動で行われます。

```text
このリポジトリ（welfare-manager-app）の開発を前任者から引き継ぎました。
docs/HANDOVER.md を読んで、以下を実行してください:

1. 前任者から受け取った .env.local がプロジェクト直下に配置されているか確認。
   無ければ、HANDOVER.md §3 の環境変数一覧を表示して、私に配置を依頼して一旦止まってください。
2. npm install を実行。
3. Supabase プロジェクトが稼働しているか確認（NEXT_PUBLIC_SUPABASE_URL に curl 等で疎通確認）。
   停止中なら HANDOVER.md §5 の復旧手順を私に案内してください。
4. npm run dev で起動し、http://localhost:3000/login が表示されることを確認。
5. HANDOVER.md §2 の「引き継ぎチェックリスト」を読み、私がまだ完了していない可能性が
   ある項目（アカウント移管・キーローテーション）を一覧にして報告してください。
6. 最後にプロジェクト構成（src/app 配下の主要画面とAPIルート）を簡潔に説明してください。

以後の開発でも docs/HANDOVER.md と docs/admin-manual.md を前提知識として使ってください。
```

---

*最終更新: 2026-07-03（前任者: Yamato）*
