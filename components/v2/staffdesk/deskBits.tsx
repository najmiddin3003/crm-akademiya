"use client";

import type { ReactNode } from "react";
import { Gift, ListChecks, Lock } from "lucide-react";

// MENEJER / IT / XIZMAT ISH STOLI (47-qism) — umumiy qismlar va so'rovlar.

export const deskQs = (as?: string, mode?: string) => (as ? `&as=${encodeURIComponent(as)}${mode ? `&mode=${mode}` : ""}` : "");

export interface ApprovalItem {
  key: string;
  kind: "topshiriq" | "sovga" | "rahbarda";
  id: number;
  title: string;
  sub: string;
  time: string;
  detail: Record<string, unknown>;
}

export const KIND_META: Record<ApprovalItem["kind"], { label: string; tone: string; Icon: typeof Gift }> = {
  topshiriq: { label: "Topshiriq", tone: "bg-v2-brand-bg text-v2-brand-text", Icon: ListChecks },
  sovga: { label: "Sovg'a", tone: "bg-v2-warning-bg text-v2-warning", Icon: Gift },
  rahbarda: { label: "Rahbarda", tone: "bg-v2-surface-2 text-v2-text-2", Icon: Lock },
};

/** Topshiriq amali — mavjud /api/staff-tasks/:id (ruxsat va bot xabari o'sha yerda). */
export async function taskAction(id: number, body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  return fetch(`/api/staff-tasks/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    .then((r) => r.json())
    .then((j) => ({ ok: !!j?.ok, error: j?.error }))
    .catch(() => ({ ok: false, error: "Serverga ulanib bo'lmadi" }));
}

export async function giftDecision(id: number, approve: boolean, comment: string, as?: string): Promise<{ ok: boolean; error?: string }> {
  return fetch("/api/staff-desk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "gift", id, approve, comment, ...(as ? { as, mode: "manager" } : {}) }) })
    .then((r) => r.json())
    .then((j) => ({ ok: !!j?.ok, error: j?.error }))
    .catch(() => ({ ok: false, error: "Serverga ulanib bo'lmadi" }));
}

export function KindIcon({ kind }: { kind: ApprovalItem["kind"] }) {
  const m = KIND_META[kind];
  return (
    <span className={`grid size-9 shrink-0 place-items-center rounded-v2-md ${m.tone}`}>
      <m.Icon className="size-4" strokeWidth={1.75} aria-hidden />
    </span>
  );
}

export function Kpi({ icon, tone, value, unit, label, danger }: { icon: ReactNode; tone: string; value: string; unit?: string; label: string; danger?: boolean }) {
  return (
    <div className="flex items-center gap-3 bg-v2-surface px-3 py-3 sm:px-4 sm:py-4">
      <span className={`hidden size-10 shrink-0 place-items-center rounded-v2-md sm:grid ${tone}`}>{icon}</span>
      <div className="min-w-0">
        <div className={`text-[1.375rem] font-semibold leading-7 tabular-nums ${danger ? "text-v2-danger" : "text-v2-text"}`}>
          {value}
          {unit ? <span className="ml-1 text-v2-small font-normal text-v2-text-2">{unit}</span> : null}
        </div>
        <div className="text-v2-caption text-v2-text-2">{label}</div>
      </div>
    </div>
  );
}

/** «2026-11-19T18:00…» → «18:00»; sana boshqa kun bo'lsa — «19.11 18:00». */
export function shortWhen(iso: string, today: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  const local = new Date(d.getTime() + 5 * 3600_000).toISOString();
  return local.slice(0, 10) === today ? local.slice(11, 16) : `${local.slice(8, 10)}.${local.slice(5, 7)} ${local.slice(11, 16)}`;
}
