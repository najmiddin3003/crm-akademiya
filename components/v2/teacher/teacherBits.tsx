"use client";

import type { ReactNode } from "react";
import { Check, Lock } from "lucide-react";
import { fanOf, FAN_BG, FAN_TEXT } from "@/components/v2/ui/fan";

// O'QITUVCHI ISH STOLI (45-qism) — sahifalar bo'lishadigan qismlar.

export const teacherQs = (teacher?: string) => (teacher ? `&teacher=${encodeURIComponent(teacher)}` : "");
export const teacherLink = (path: string, teacher?: string) => (teacher ? `${path}${path.includes("?") ? "&" : "?"}teacher=${encodeURIComponent(teacher)}` : path);

export async function teacherPost<T = Record<string, unknown>>(body: Record<string, unknown>, teacher?: string): Promise<(T & { ok: true }) | { ok: false; error: string }> {
  return fetch("/api/teacher", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, ...(teacher ? { teacher } : {}) }) })
    .then((r) => r.json())
    .catch(() => ({ ok: false, error: "Serverga ulanib bo'lmadi" }));
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm sm:p-5 ${className}`}>{children}</section>;
}

export function CardTitle({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-v2-section text-v2-text">{title}</h2>
        {sub ? <p className="text-v2-small text-v2-text-3">{sub}</p> : null}
      </div>
      {right}
    </div>
  );
}

export function FanPill({ course, children }: { course: string; children: ReactNode }) {
  const f = fanOf(course);
  return <span className={`inline-flex shrink-0 items-center rounded-v2-sm px-2 py-0.5 text-v2-caption font-medium ${FAN_BG[f]} ${FAN_TEXT[f]}`}>{children}</span>;
}

export type StepState = "done" | "locked" | "todo";

/** Dars qadami kartochkasi: ✓ (bajarildi) · qulf (avval boshqasi) · raqam (navbatdagi). */
export function StepBox({ n, title, sub, state, active = false, onClick }: { n: number; title: string; sub: ReactNode; state: StepState; active?: boolean; onClick?: () => void }) {
  const icon =
    state === "done" ? (
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-v2-success text-v2-on-color">
        <Check className="size-3.5" strokeWidth={2.5} aria-hidden />
      </span>
    ) : state === "locked" ? (
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-v2-warning-bg text-v2-warning">
        <Lock className="size-3.5" strokeWidth={2} aria-hidden />
      </span>
    ) : (
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-v2-surface-2 text-v2-caption font-semibold text-v2-text-2">{n}</span>
    );
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`flex min-w-0 items-start gap-2.5 rounded-v2-md border px-3 py-2.5 text-left ${active ? "border-v2-brand bg-v2-brand-bg" : "border-v2-border bg-v2-surface"} ${onClick ? "hover:bg-v2-surface-2" : ""}`}
    >
      {icon}
      <span className="min-w-0">
        <span className="block text-v2-small font-semibold text-v2-text">{title}</span>
        <span className={`block text-v2-caption ${state === "locked" ? "text-v2-warning" : "text-v2-text-2"}`}>{sub}</span>
      </span>
    </Tag>
  );
}

export const fmtSum = (n: number) => Math.round(n).toLocaleString("ru-RU").replace(/,/g, " ");
