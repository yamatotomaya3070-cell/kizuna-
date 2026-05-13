import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export default function BillingSuccessPage() {
  return (
    <div className="mx-auto max-w-xl px-6 py-16 text-center">
      <CheckCircle2 size={44} className="mx-auto mb-4 text-blue-900" />
      <h1 className="text-2xl font-bold text-slate-800">決済が完了しました</h1>
      <p className="mt-2 text-sm text-slate-500">プランの反映まで少し時間がかかる場合があります。</p>
      <Link
        href="/billing"
        className="mt-6 inline-flex rounded-xl bg-blue-900 px-5 py-3 text-sm font-bold text-white hover:bg-blue-900"
      >
        プラン画面に戻る
      </Link>
    </div>
  );
}
