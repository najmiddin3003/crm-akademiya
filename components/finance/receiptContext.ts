"use client";

import { useSyncExternalStore } from "react";
import { RECEIPT_DEFAULTS, type ReceiptBranch, type ReceiptProfile } from "@/lib/receiptProfile";

// CHEK SOZLAMASI — MIJOZ KESHI (23-qism, 13.11.2026). Kassa cheki (ko'rib chiqish
// oynasi va bosma) shundan o'qiydi: GET /api/center-profile bir marta so'raladi,
// keyin xotirada. «Markaz ma'lumotlari» sahifasi saqlagach `setReceiptContext` bilan
// yangilaydi — shu oynadagi keyingi cheklar darhol yangi ko'rinishda.
//
// Ko'rib chiqish oynasi DOIM bosmadan oldin ochiladi, shuning uchun `printReceipt`
// sinxron `getReceiptContext()` dan oladi; kesh hali bo'sh bo'lsa — sukut (chek
// baribir chiqadi, faqat manzilsiz).

export interface ReceiptContext {
  receipt: ReceiptProfile;
  branch: ReceiptBranch | null;
}

const DEFAULT_CTX: ReceiptContext = { receipt: RECEIPT_DEFAULTS, branch: null };

let ctx: ReceiptContext | null = null;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function load() {
  if (ctx || inflight) return;
  inflight = fetch("/api/center-profile")
    .then((r) => r.json())
    .then((d) => {
      if (d?.ok) {
        ctx = { receipt: d.receipt ?? RECEIPT_DEFAULTS, branch: d.branch ?? null };
        emit();
      }
    })
    .catch(() => {})
    .finally(() => {
      inflight = null;
    });
}

export function getReceiptContext(): ReceiptContext {
  return ctx ?? DEFAULT_CTX;
}

export function setReceiptContext(next: ReceiptContext) {
  ctx = next;
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  load();
  return () => listeners.delete(cb);
}

/** Chek ko'rinishi (birinchi chaqiruvda serverdan yuklanadi). */
export function useReceiptContext(): ReceiptContext {
  return useSyncExternalStore(subscribe, getReceiptContext, () => DEFAULT_CTX);
}
