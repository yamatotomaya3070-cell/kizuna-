"use client";

import { useState } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { ChevronDown, CheckCircle2, Clock } from "lucide-react";
import { learningSteps } from "@/data/mock";

// ---- アニメーション variants ----

const containerVariants: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.15, delayChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

const heroVariants: Variants = {
  hidden: { opacity: 0, scale: 0.94 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: "easeOut" } },
};

// ---- ステップコネクタ（縦線） ----
function StepConnector() {
  return (
    <div className="flex justify-center">
      <div className="w-0.5 h-6 bg-gradient-to-b from-slate-300 to-slate-200" />
    </div>
  );
}

// ---- アコーディオン単体 ----
function StepCard({ step, index }: { step: (typeof learningSteps)[number]; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div variants={itemVariants}>
      <div
        className={`rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden transition-shadow duration-300 ${
          open ? "shadow-md" : "hover:shadow-md"
        }`}
      >
        {/* ヘッダー（クリックで開閉） */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center gap-4 px-5 py-4 text-left"
          aria-expanded={open}
        >
          {/* ステップ番号バッジ */}
          <div
            className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow ${step.ringColor}`}
          >
            {index + 1}
          </div>

          {/* 絵文字 ＋ タイトル */}
          <div
            className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-xl ${step.color}`}
          >
            {step.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
              Step {index + 1}
            </p>
            <p className="text-base font-bold text-slate-800 leading-snug">
              {step.title}
            </p>
          </div>

          {/* 所要時間 */}
          <span className="hidden sm:flex items-center gap-1 text-xs text-slate-400 flex-shrink-0">
            <Clock size={13} />
            {step.duration}
          </span>

          {/* シェブロン */}
          <ChevronDown
            size={18}
            className={`flex-shrink-0 text-slate-400 transition-transform duration-300 ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>

        {/* サマリー */}
        <div className="px-5 pb-3 -mt-1">
          <p className="text-sm text-slate-500">{step.summary}</p>
        </div>

        {/* アコーディオン本体 */}
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5 pt-1 border-t border-dashed border-slate-200">
                <ul className="space-y-2 mt-3">
                  {step.details.map((line, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                      <CheckCircle2
                        size={16}
                        className="flex-shrink-0 mt-0.5 text-blue-400"
                      />
                      {line}
                    </li>
                  ))}
                </ul>
                <button className="mt-5 w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-900 to-blue-900 text-white text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow">
                  このステップを開始する →
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ---- メイン export ----
export default function ELearningSteps() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-2"
    >
      {/* ヒーローバナー */}
      <motion.div
        variants={heroVariants}
        initial="hidden"
        animate="show"
        className="rounded-3xl bg-gradient-to-br from-blue-900 via-blue-900 to-blue-900 p-8 text-white shadow-lg mb-8 relative overflow-hidden"
      >
        {/* 背景装飾 */}
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-10 -left-6 w-32 h-32 rounded-full bg-white/10" />

        <div className="relative flex flex-col sm:flex-row items-center gap-6">
          {/* キャラクター / イラスト プレースホルダー */}
          <div className="flex-shrink-0 w-28 h-28 rounded-3xl bg-white/20 border-2 border-white/40 flex flex-col items-center justify-center text-4xl shadow-inner">
            🌟
            <span className="text-[10px] text-white/70 mt-1 font-medium">キャラクター</span>
          </div>

          <div>
            <p className="text-white/70 text-sm font-semibold uppercase tracking-widest mb-1">
              Welcome !
            </p>
            <h2 className="text-2xl sm:text-3xl font-extrabold leading-tight">
              障害福祉の世界へ
              <br />
              ようこそ！🎉
            </h2>
            <p className="mt-2 text-white/80 text-sm leading-relaxed max-w-sm">
              このガイドでは、施設の運営を始めるために必要な
              <span className="font-bold text-white"> 3つのステップ</span>
              をやさしく説明します。一緒に進めていきましょう！
            </p>
          </div>
        </div>

        {/* 進捗インジケーター */}
        <div className="relative mt-6 flex items-center gap-2">
          {learningSteps.map((_, i) => (
            <div key={i} className="flex-1 h-1.5 rounded-full bg-white/30">
              <div className="h-full rounded-full bg-white w-0" />
            </div>
          ))}
          <span className="text-xs text-white/70 ml-1 flex-shrink-0">0 / {learningSteps.length}</span>
        </div>
      </motion.div>

      {/* ステップカード */}
      {learningSteps.map((step, i) => (
        <div key={step.id}>
          <StepCard step={step} index={i} />
          {i < learningSteps.length - 1 && <StepConnector />}
        </div>
      ))}
    </motion.div>
  );
}
