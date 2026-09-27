"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/shared/Language";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { toUz } from "@/lib/uzTime";
import ProfileModal from "@/components/gamification/profile/ProfileModal";
import { useGamToast } from "@/components/gamification/ui";

// O'quvchi profili → «Coin tarixi» (referens saytdagi 9 ustunli jadval).
// 26.09.2026 dan HAQIQIY ma'lumot — gamifikatsiya tanga yozuvlari
// (coin_transactions): kim, turi, miqdor, o'sha paytdagi avvalgi/yangi
// balans, sana, sabab va izoh. Bekor qilingan yozuv chizilgan holda.
// «Gamifikatsiya profili» — to'liq oyna (TZ 5.4: tarix filtrlari, storno,
// sabab bo'yicha tanga, do'st bonusi).

interface Row {
  id: number;
  createdByName: string;
  label: string;
  type: string;
  amount: number;
  applied: number;
  before: number;
  after: number;
  createdAt: string;
  note: string;
  status: "active" | "cancelled";
  cancelNote: string | null;
}

function fmtStamp(iso: string): string {
  const d = toUz(new Date(iso));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} | ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");

export default function CoinTabContent({ pupilId }: { pupilId?: number }) {
  const { t } = useT();
  const [toastNode, toast] = useGamToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!pupilId) return;
    let alive = true;
    fetch(`/api/gamification/students/${pupilId}/ledger`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d?.ok) {
          setRows(d.rows as Row[]);
          setError("");
        } else {
          setRows([]);
          setError(String(d?.error || "Ma'lumotlarni yuklab bo'lmadi"));
        }
      })
      .catch(() => {
        if (alive) {
          setRows([]);
          setError("Tarmoq xatoligi");
        }
      });
    return () => {
      alive = false;
    };
  }, [pupilId, tick]);

  const loading = !!pupilId && rows === null;
  const list = rows ?? [];

  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      {toastNode}
      <div className="flex flex-wrap items-center justify-end gap-2 p-3 border-b border-border">
        {pupilId && !error && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center h-7 px-3 rounded-md bg-primary text-white text-[12px] font-medium hover:opacity-90"
          >
            {t("Gamifikatsiya profili")}
          </button>
        )}
        <span className="inline-flex items-center h-7 px-3 rounded-md bg-secondary/50 text-[12px] font-medium tabular-nums">
          {t("Umumiy soni: {n}", { n: list.length })}
        </span>
      </div>
      <div className="table-box">
        <table className="w-full text-sm">
          <thead className="text-[12px] text-muted-foreground uppercase">
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left font-medium">№</th>
              <th className="px-4 py-3 text-left font-medium">{t("Kim tomonidan")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("Turi")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("Miqdori")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("Avvalgi balans")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("Yangi balans")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("Yaratildi")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("Sababi")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("Izoh")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.map((r, i) => {
              const cx = r.status === "cancelled";
              const kind = r.type === "shop" ? t("Xarid") : r.amount > 0 ? t("Berildi") : t("Ayirildi");
              return (
                <tr key={r.id} className={cx ? "bg-secondary/30" : ""}>
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">{i + 1}</td>
                  <td className="px-4 py-3 text-[13px] whitespace-nowrap">{t(r.createdByName)}</td>
                  <td className="px-4 py-3 text-[13px] whitespace-nowrap">{kind}</td>
                  <td
                    className={`px-4 py-3 text-[13px] font-semibold tabular-nums whitespace-nowrap ${
                      cx ? "line-through opacity-60" : r.amount > 0 ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {signed(r.amount)}
                  </td>
                  <td className="px-4 py-3 text-[13px] tabular-nums">{r.before}</td>
                  <td className="px-4 py-3 text-[13px] tabular-nums">{r.after}</td>
                  <td className="px-4 py-3 text-[13px] tabular-nums whitespace-nowrap">{fmtStamp(r.createdAt)}</td>
                  <td className="px-4 py-3 text-[13px]">{t(r.label)}</td>
                  <td className="px-4 py-3 text-[13px]">
                    {t(r.note)}
                    {cx && <div className="text-[12px] text-rose-600">{t("Bekor qilindi: {note}", { note: t(r.cancelNote ?? "") })}</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {loading && <SpinnerBlock />}
      {!loading && list.length === 0 && (
        <div className="py-16 text-center">
          <svg viewBox="0 0 24 24" className="w-12 h-12 mx-auto text-muted-foreground/40 mb-2" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M8 10h8M8 14h5" />
          </svg>
          <div className="text-[14px] font-medium">{t("Ma'lumotlar topilmadi")}</div>
          <div className="text-[12px] text-muted-foreground mt-0.5">{error ? t(error) : t("Bu o'quvchida hali tanga yozuvi yo'q.")}</div>
        </div>
      )}
      {open && pupilId && (
        <ProfileModal pupilId={pupilId} onClose={() => setOpen(false)} toast={toast} onChanged={() => setTick((x) => x + 1)} />
      )}
    </div>
  );
}
