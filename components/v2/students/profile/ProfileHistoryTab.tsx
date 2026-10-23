"use client";

import { useState } from "react";
import { History } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import ActivityList from "./ActivityList";
import { ACTIVITY_FILTER, type ActivityFilter, type ActivityItem } from "./profileActivity";
import { Card, EmptyBlock, SegTabs, linkBtn } from "./profileBits";
import type { TabProps } from "./profileTypes";

// YANGI VERSIYA — O'QUVCHI SAHIFASI · TARIX (rasmi yo'q, SAVOLLAR 151): «So'nggi
// harakatlar» ning to'liq ro'yxati — oy bo'yicha bo'lingan, tur bo'yicha segment
// (Hammasi | To'lovlar | Davomat | Guruh va holat), 40 tadan. Manba — profileActivity.ts.
// Eski tizim (edutizim) to'lovlari — eski ko'rinishda.

const PAGE = 40;

export default function ProfileHistoryTab({ data, activity, fmt }: TabProps) {
  const { t } = useT();
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [limit, setLimit] = useState(PAGE);
  const list = filter === "all" ? activity : activity.filter((x) => ACTIVITY_FILTER[x.kind] === filter);
  const shown = list.slice(0, limit);

  // Oy bo'yicha bo'laklar (ro'yxat yangidan eskiga tartiblangan).
  const chunks: { month: string; items: ActivityItem[] }[] = [];
  for (const x of shown) {
    const m = x.date.slice(0, 7);
    const lastChunk = chunks[chunks.length - 1];
    if (lastChunk && lastChunk.month === m) lastChunk.items.push(x);
    else chunks.push({ month: m, items: [x] });
  }
  const count = (f: Exclude<ActivityFilter, "all">) => activity.filter((x) => ACTIVITY_FILTER[x.kind] === f).length;

  return (
    <Card
      title={t("Tarix")}
      count={t("{n} ta", { n: list.length })}
      flush
      action={
        <SegTabs
          value={filter}
          onChange={(v) => {
            setFilter(v);
            setLimit(PAGE);
          }}
          options={[
            { value: "all", label: t("Hammasi") },
            { value: "payments", label: `${t("To'lovlar")} ${count("payments")}` },
            { value: "attendance", label: `${t("Davomat")} ${count("attendance")}` },
            { value: "groups", label: `${t("Guruh va holat")} ${count("groups")}` },
          ]}
          label={t("Harakat turi")}
        />
      }
    >
      {list.length === 0 ? (
        <div className="border-t border-v2-border">
          <EmptyBlock icon={<History className="size-5" strokeWidth={1.75} />} title={t("Hali harakat yo'q")} />
        </div>
      ) : (
        chunks.map((c) => (
          <section key={c.month} aria-label={`${fmt.monthName(c.month)} ${c.month.slice(0, 4)}`}>
            <h3 className="border-y border-v2-border bg-v2-surface-2 px-4 py-1.5 text-v2-caption font-semibold text-v2-text-2">
              {fmt.monthName(c.month)} {c.month.slice(0, 4)}
            </h3>
            <ActivityList items={c.items} data={data} fmt={fmt} />
          </section>
        ))
      )}
      {list.length > limit && (
        <div className="border-t border-v2-border px-4 py-2.5">
          <button type="button" onClick={() => setLimit((n) => n + PAGE)} className={linkBtn}>
            {t("Yana {n} ta ko'rsatish", { n: Math.min(PAGE, list.length - limit) })}
          </button>
        </div>
      )}
      <div className="border-t border-v2-border px-4 py-2.5 text-v2-caption text-v2-text-3">
        {t("Davomatdan faqat qoldirilgan, kechikkan va birinchi darslar ko'rsatiladi; to'liq davomat — Davomat tabida.")}
        {data.legacyCount > 0 && (
          <>
            {" "}
            {t("Eski tizimdagi to'lovlar (09.2026 gacha): {n} ta.", { n: data.legacyCount })}{" "}
            <Link href={`/student-edit/${data.pupil.id}?src=list&classic=1&tab=tranzaksiya`} className="font-medium text-v2-brand-text underline-offset-2 hover:underline">
              {t("Eski ko'rinishda ochish")}
            </Link>
          </>
        )}
      </div>
    </Card>
  );
}
