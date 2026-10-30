"use client";

import { useState } from "react";
import { useT } from "@/components/shared/Language";
import FaceCapture, { type FaceCaptureResult } from "./FaceCapture";

// FACE ID SINOVI (/xodim/yuz-sinov, 30.10.2026). Kamera, yuz aniqlash va
// jonlilik shu telefonda ishlaydimi — va ikki surat orasidagi masofa
// qanchaligini ko'rsatadi: bir odamniki chegaradan (0.5) kichik, boshqa
// odamniki katta bo'lishi kerak. Hech narsa serverga ketmaydi.

const THRESHOLD = 0.5;

function distance(a: readonly number[], b: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return Math.sqrt(s);
}

function mean(list: readonly (readonly number[])[]): number[] {
  const out = new Array<number>(list[0]?.length ?? 0).fill(0);
  for (const d of list) for (let i = 0; i < d.length; i++) out[i] += d[i] / list.length;
  return out;
}

function spread(list: readonly (readonly number[])[]): number {
  let max = 0;
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) max = Math.max(max, distance(list[i], list[j]));
  return max;
}

const fmt = (n: number) => n.toFixed(3);

export default function FaceTestPage({ liveness }: { liveness: boolean }) {
  const { t } = useT();
  const [results, setResults] = useState<FaceCaptureResult[]>([]);
  const [running, setRunning] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const first = results[0] ? mean(results[0].descriptors) : null;

  return (
    <div className="mx-auto max-w-md space-y-4 p-5">
      <h1 className="text-center text-[18px] font-bold">🙂 {t("Face ID sinovi")}</h1>
      <p className="text-center text-[13px] text-muted-foreground">
        {t("Kamera va yuz aniqlash shu telefonda ishlashini tekshiradi. Hech narsa saqlanmaydi.")}
      </p>

      {running ? (
        <div className="rounded-2xl border border-border bg-card p-5">
          <FaceCapture
            key={attempt}
            purpose="enroll"
            liveness={liveness}
            debug
            onCaptured={(r) => {
              setResults((prev) => [...prev, r]);
              setRunning(false);
            }}
          />
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => {
          setAttempt((a) => a + 1);
          setRunning(true);
        }}
        className="h-12 w-full rounded-xl bg-primary text-[15px] font-semibold text-white hover:opacity-90"
      >
        {running ? t("🔄 Qayta boshlash") : results.length ? t("📷 Yana bir surat") : t("📷 Boshlash")}
      </button>

      {results.map((r, i) => {
        const d = first && i > 0 ? distance(first, mean(r.descriptors)) : null;
        return (
          <div key={i} className="flex gap-3 rounded-2xl border border-border bg-card p-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- data: URL, optimallashtirish kerak emas */}
            <img src={r.photo} alt="" className="size-20 shrink-0 rounded-xl object-cover" />
            <div className="min-w-0 space-y-0.5 text-[12px]">
              <p className="text-[14px] font-semibold">{t("{n}-surat", { n: i + 1 })}</p>
              {d !== null && (
                <p className={d <= THRESHOLD ? "font-semibold text-emerald-700 dark:text-emerald-300" : "font-semibold text-rose-700 dark:text-rose-300"}>
                  {t("1-suratdan masofa: {d}", { d: fmt(d) })} — {d <= THRESHOLD ? t("bir odam") : t("boshqa odam")}
                </p>
              )}
              <p className="text-muted-foreground">
                {t("Jonlilik")}: {r.stats.live === "blink" ? t("ko'z yumish") : r.stats.live === "turn" ? t("bosh burish") : t("o'chiq")}
                {" · "}
                {t("kadrlar ichidagi farq: {d}", { d: fmt(spread(r.descriptors)) })}
              </p>
              <p className="text-muted-foreground">
                {`${r.stats.backend} · ${r.stats.loadMs} ms · ${r.stats.frameMs} ms · eye ${r.stats.eyeOpen} / ${r.stats.eyeMin}`}
              </p>
            </div>
          </div>
        );
      })}

      {results.length > 0 && (
        <button
          type="button"
          onClick={() => setResults([])}
          className="h-11 w-full rounded-xl border border-border bg-card text-[14px] font-medium hover:bg-secondary"
        >
          {t("Tozalash")}
        </button>
      )}
    </div>
  );
}
