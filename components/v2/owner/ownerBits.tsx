"use client";

import type { ReactNode } from "react";
import { BadgePercent, Gavel, HandCoins } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";

// RAHBAR PANELI (48-qism) — umumiy qismlar.

export const nf = (n: number) => Math.round(n).toLocaleString("ru-RU").replace(/,/g, " ");

export async function ownerPost(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; [k: string]: unknown }> {
  return fetch("/api/owner", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    .then((r) => r.json())
    .catch(() => ({ ok: false, error: "Serverga ulanib bo'lmadi" }));
}

export type Tone = "success" | "danger" | "warning" | "info" | "neutral" | "brand";
export const TONE: Record<Tone, string> = {
  success: "bg-v2-success-bg text-v2-success",
  danger: "bg-v2-danger-bg text-v2-danger",
  warning: "bg-v2-warning-bg text-v2-warning",
  info: "bg-v2-info-bg text-v2-info",
  neutral: "bg-v2-surface-2 text-v2-text-2",
  brand: "bg-v2-brand-bg text-v2-brand-text",
};

export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`inline-flex shrink-0 items-center gap-1 rounded-v2-sm px-1.5 py-0.5 text-v2-caption font-medium ${TONE[tone]}`}>{children}</span>;
}

/** Filial raqami doirada (1, 2, 3, 4) — rasmdagi rangli belgi. */
export function BranchDot({ n }: { n: number }) {
  const tones = ["bg-v2-violet-bg text-v2-violet", "bg-v2-info-bg text-v2-info", "bg-v2-success-bg text-v2-success", "bg-v2-warning-bg text-v2-warning"];
  return <span className={`grid size-8 shrink-0 place-items-center rounded-full text-v2-small font-semibold ${tones[(n - 1) % 4]}`}>{n}</span>;
}

export function ApprovalIcon({ kind }: { kind: string }) {
  const Icon = kind === "avans" ? HandCoins : kind === "jarima" ? Gavel : BadgePercent;
  const tone = kind === "avans" ? "bg-v2-warning-bg text-v2-warning" : kind === "jarima" ? "bg-v2-danger-bg text-v2-danger" : "bg-v2-info-bg text-v2-info";
  return (
    <span className={`grid size-9 shrink-0 place-items-center rounded-v2-md ${tone}`}>
      <Icon className="size-4" strokeWidth={1.75} aria-hidden />
    </span>
  );
}

export function Crumbs({ here }: { here: string }) {
  const { t } = useT();
  return (
    <div className="text-v2-small text-v2-text-3">
      <Link href="/owner" className="hover:text-v2-text">{t("Rahbar paneli")}</Link> › {t(here)}
    </div>
  );
}

export function MoneyBar({ parts }: { parts: { key: string; value: number; cls: string }[] }) {
  const total = parts.reduce((a, p) => a + Math.max(0, p.value), 0);
  return (
    <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-v2-track">
      {total > 0 ? parts.filter((p) => p.value > 0).map((p) => <span key={p.key} className={p.cls} style={{ width: `${(p.value / total) * 100}%` }} />) : null}
    </div>
  );
}
