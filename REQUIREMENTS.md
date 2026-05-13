# 要件定義書 — welfare-manager-app

最終更新: 2026-05-08
バージョン: 0.1（プロトタイプ完成・本番化直前）

---

## 1. プロジェクト概要

### 1.1 サービス名
welfare-manager-app（合同会社絆 提供）

### 1.2 目的
福祉施設向けの **日報・記録管理SaaS**。スマホからLINE感覚で日々の記録を蓄積し、**監査時に「適正に評価・記録を行っている」ことを証明できる証拠データ**として出力することを最終価値とする。

### 1.3 3層の価値構造
| 層 | ステークホルダー | 価値 |
|---|---|---|
| 1 | 提供元（合同会社絆） | サブスク型SaaSとして施設へ販売／入力状況を管理画面で把握し、滞ったら通知で促す |
| 2 | 福祉施設（顧客） | 限界体制・PC不慣れスタッフでもスマホで適正な日報を作成・蓄積できる |
| 3 | 役所・監査（最終ターゲット） | 蓄積データを出力し「毎日適正に評価・記録している」証拠とする |

### 1.4 差別化ポイント
- **入力が滞ったら通知**してシステムの形骸化を防ぐ（LINE / メール）
- **超簡易UI**（スマホファースト・多ステップ式の日報入力）
- **監査用エクスポート**（PDF / CSV）

---

## 2. 想定ユーザー

| ロール | 説明 | 主な利用画面 |
|---|---|---|
| admin | 提供元（絆）の管理者 | `/admin`, `/dashboard`, `/monitoring`, `/billing`, `/clients`, `/status`, `/attendance`, `/facilities` |
| client（施設スタッフ） | 福祉施設の事務員・支援員 | `/`（ホーム）, `/diary`, `/documents`, `/billing-report`, `/elearning`, `/settings` |
| 監査担当（間接利用） | 行政・第三者監査 | client側がエクスポートしたPDF/CSVを受領 |

---

## 3. 機能要件

### 3.1 認証・ロール管理
- Supabase Auth によるメール/パスワード認証
- `profiles.role` で `admin` / `client` を識別
- `proxy.ts`（middleware）でルート保護
  - `/admin`, `/dashboard` 系 → admin限定
  - 未認証は `/login` へリダイレクト
- LIFF経由のLINE認証（`/api/liff/auth`）

### 3.2 日報機能（client中心）
- `/diary`: 日次の支援記録入力（多ステップUI、スマホ最適化）
- `/diary/batch`: 複数日まとめ入力
- 利用者ごとの記録、サービス種別対応
- 記録の蓄積 → 監査エビデンスとしての出力

### 3.3 書類生成（client）
- `/documents`: 書類一覧・ダウンロード
- `/documents/generate`: テンプレートベースの帳票生成
- `/api/generate-document`: 日本語PDF生成（蓄積データから）
- Supabase Storage `welfare-docs` バケットに保存

### 3.4 モニタリング・AI評価（admin）
- `/monitoring`: 利用者ごとの状況把握
- `/api/generate-monitoring`: Gemini APIによるAI評価生成

### 3.5 入力状況管理・通知（admin）
- `/status`: 施設ごと・利用者ごとの入力状況一覧
- 入力滞留検知 → LINE / メール通知
  - `/api/send-line`, `/api/send-email`, `/api/line-webhook`

### 3.6 出退勤管理
- `/attendance`: 日次出退勤記録
- マイグレーション: `20260426_daily_attendance.sql`

### 3.7 利用者・施設マスタ（admin）
- `/clients`: 利用者マスタ（`20260502_client_master.sql`）
- `/facilities`: 施設マスタ
- `/api/create-facility`: 施設新規登録

### 3.8 課金・請求
- `/billing`（admin）: 契約・請求状況
- `/billing-report`（client）: 施設側の請求レポート
- `/api/create-checkout`: Stripe Checkout（3プラン想定）
  - ライト ¥5,000 / スタンダード ¥12,000 / プレミアム ¥20,000（要確定）

### 3.9 e-learning
- `/elearning`, `/e-learning`: スタッフ向け研修コンテンツ（要件詳細未確定）

### 3.10 タスク管理（admin）
- `/dashboard` 上のタスク管理
- マイグレーション: `20260427_tasks.sql`（実行未完了）

---

## 4. 非機能要件

### 4.1 性能・UX
- スマホファースト（client側）
- LINE風の操作感（ポチポチ入力）
- 戻るボタンは `router.back()` で履歴ベース

### 4.2 可用性・運用
- ホスティング: Vercel（本番URL: https://welfare-manager-app.vercel.app）
- DB/Auth/Storage: Supabase
- AI: Gemini API
- メール: Resend（任意）
- LINE: LIFF + Messaging API

### 4.3 セキュリティ
- Supabase RLS による行レベル制御
- ロールベースのルート保護（middleware）
- Storageバケットは Private、認証済みのみread/write

### 4.4 監査対応
- 日報・モニタリング・帳票はPDF出力可能（日本語フォント対応）
- 蓄積データは改ざん検知可能な形で保持（要設計）

---

## 5. 技術スタック

| カテゴリ | 技術 |
|---|---|
| フロント | Next.js 16（App Router）+ TypeScript |
| UI | Tailwind CSS / Lucide React |
| 認証・DB・Storage | Supabase |
| AI | Google Gemini API |
| 決済 | Stripe |
| 通知 | LINE Messaging API / LIFF / Resend |
| ホスティング | Vercel |

---

## 6. データモデル（マイグレーション一覧）

| ファイル | 内容 |
|---|---|
| `00_base_schema.sql` | profiles・facilities・diaries等の基盤 |
| `20260426_daily_attendance.sql` | 出退勤 |
| `20260426_service_type.sql` | サービス種別 |
| `20260427_diary_role_column.sql` | 日報のロール列追加 |
| `20260427_line_users.sql` | LINEユーザー紐付け |
| `20260427_tasks.sql` | タスク管理（**未実行**） |
| `20260502_client_master.sql` | 利用者マスタ |

---

## 7. 残タスク（`TODO.md` 参照）

### 🔴 必須
1. adminアカウント作成（Supabase Auth → profiles更新）
2. `tasks` テーブルSQL実行（`20260427_tasks.sql`）
3. Supabase Storage `welfare-docs` バケット作成

### 🟡 重要
- Stripe設定（プラン・価格確定）
- LINE設定（LIFF + Messaging API）

### 🟢 任意
- Resend（メール通知）
- 料金プラン最終確定

---

## 8. 用語集

| 用語 | 意味 |
|---|---|
| 日報 | 福祉施設で日々作成する利用者支援記録 |
| モニタリング | 利用者の状態を定期的に評価する文書 |
| 監査 | 行政による施設運営の適正性チェック |
| LIFF | LINE Front-end Framework（LINE内ブラウザでWebアプリ動作） |
