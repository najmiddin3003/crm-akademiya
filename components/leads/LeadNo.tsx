"use client";

import { useT } from "@/components/shared/Language";
import { branchPool } from "@/lib/branchPools";
import { orderNo, type Order } from "@/lib/ordersData";

// LID RAQAMI + filial belgisi (09.10.2026, 1+2 hovuzi — lib/branchPools.ts).
//
// Lid raqami (`branchNo`) filial ichida yuritilgan: eski №1–№92 ikkala
// Chortoq filialida bor va endi bitta ro'yxatda turadi. Hovuzning ikkinchi
// filiali lidi yonida kichik «2-filial» belgisi — «#57» qaysi lid ekani
// adashmasin. Hovuzsiz filiallarda (3, 4) belgi chiqmaydi.

/** Faqat belgi (raqam boshqa joyda yozilgan bo'lsa). */
export function LeadBranchTag({ branchId }: { branchId: number | null | undefined }) {
  const { t } = useT();
  const branch = Number(branchId ?? 1) || 1;
  const pool = branchPool(branch);
  if (pool.length < 2 || branch === pool[0]) return null;
  return <span className="ml-1 text-[10px] font-normal text-muted-foreground">{t("{n}-filial", { n: branch })}</span>;
}

export default function LeadNo({ order }: { order: Pick<Order, "id" | "branchNo" | "branchId"> }) {
  return (
    <>
      {orderNo(order)}
      <LeadBranchTag branchId={order.branchId} />
    </>
  );
}
