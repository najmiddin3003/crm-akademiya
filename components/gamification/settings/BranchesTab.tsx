"use client";

import "../gamification.css";
import { useCallback, useEffect, useState } from "react";
import { SpinnerBlock } from "@/components/ui/Spinner";
import Link from "@/components/ui/Link";
import MoneyInput from "@/components/ui/MoneyInput";
import { useToast } from "@/components/ui/Toast";
import { useLang, useT } from "@/components/shared/Language";
import { MONTHS } from "@/lib/i18n";
import { gamApi } from "../api";
import { cardCls } from "../ui";
import { nfSom } from "../shop/ShopModals";

// Sozlamalar → Gamifikatsiya → Filiallar va byudjet (TZ 4.17, 5.7;
// prototipdagi filialView). Filiallar — CRM'ning umumiy ro'yxati
// (Boshqaruv → Filiallar): nomini o'zgartirish, qo'shish va o'chirish o'sha
// sahifada, bu yerda alohida ro'yxat yaratilmaydi. Bu tabda — har filialning
// oylik sovg'a byudjeti (bo'sh — cheklanmagan), joriy oy sarfi va guruhlar
// soni. Faqat direktor.

interface Row {
  branchId: number;
  name: string;
  limit: number | null;
  spent: number;
  groups: number;
}

function BudgetInput({ row, onSaved }: { row: Row; onSaved: (r: Row) => void }) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const initial = row.limit === null ? "" : String(row.limit);
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  async function commit() {
    if (draft === initial || busy) return;
    setBusy(true);
    const res = await gamApi<{ monthlyLimitSom: number | null }>("/api/gamification/shop/budget", {
      method: "PUT",
      body: { branchId: row.branchId, monthlyLimitSom: draft },
    });
    setBusy(false);
    if (!res.ok) {
      showError(t(res.error));
      setDraft(initial);
      return;
    }
    onSaved({ ...row, limit: res.monthlyLimitSom });
    showSuccess(res.monthlyLimitSom === null ? t("Byudjet cheklanmagan") : t("Saqlandi"));
  }
  return (
    <MoneyInput
      aria-label={t("Oylik byudjet")}
      placeholder={t("cheklanmagan")}
      value={draft}
      disabled={busy}
      onChange={setDraft}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className="h-10 w-full max-w-[180px] rounded-lg border border-border bg-card px-3 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
    />
  );
}

export default function GamBranchesTab() {
  const { t } = useT();
  const [lang] = useLang();
  const [data, setData] = useState<{ month: string; rows: Row[] } | null>(null);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(
    () =>
      gamApi<{ month: string; rows: Row[] }>("/api/gamification/shop/budget").then((res) => {
        if (!res.ok) setLoadError(res.error);
        else setData({ month: res.month, rows: res.rows });
      }),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);

  if (loadError && !data) return <div className={`${cardCls} text-sm text-muted-foreground`}>{t(loadError)}</div>;
  if (!data) return <SpinnerBlock />;
  const month = (MONTHS[lang] ?? MONTHS.uz)[Number(data.month.slice(5, 7)) - 1] ?? data.month;
  const spentLabel = t("{month}da berilgan", { month });

  return (
    <div className="gm-page space-y-3">
      <div className={`${cardCls} space-y-3`}>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[15px] font-semibold">{t("Filiallar va oylik sovg'a byudjeti")}</h3>
          <Link href="/management-filiallar" className="ml-auto text-[12.5px] font-semibold text-primary hover:underline">
            {t("Filiallarni boshqarish →")}
          </Link>
        </div>
        <p className="text-[12.5px] text-muted-foreground">
          {t("Filiallar — CRM'dagi umumiy ro'yxat: nomini o'zgartirish, qo'shish va o'chirish Boshqaruv → Filiallar sahifasida. Byudjet — oyiga shu filialda beriladigan buyumlar tannarxi chegarasi; bo'sh qoldirilsa cheklanmagan.")}
        </p>
        <div className="gm-scroll-card overflow-x-auto rounded-xl border border-border">
          <table className="gm-table">
            <thead>
              <tr>
                <th>{t("Filial")}</th>
                <th>{t("Oylik byudjet (so'm)")}</th>
                <th>{spentLabel}</th>
                <th>{t("Qoldiq")}</th>
                <th>{t("Guruhlar")}</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.branchId}>
                  <td data-l="" className="gm-lead font-semibold">
                    {r.name}
                  </td>
                  <td data-l={t("Oylik byudjet")}>
                    <BudgetInput
                      key={`${r.branchId}:${r.limit ?? ""}`}
                      row={r}
                      onSaved={(nr) => setData((d) => (d ? { ...d, rows: d.rows.map((x) => (x.branchId === nr.branchId ? nr : x)) } : d))}
                    />
                  </td>
                  <td data-l={spentLabel}>{nfSom(r.spent)}</td>
                  <td data-l={t("Qoldiq")}>{r.limit === null ? "—" : <span className={r.limit - r.spent < 0 ? "gm-neg" : ""}>{nfSom(r.limit - r.spent)}</span>}</td>
                  <td data-l={t("Guruhlar")}>{r.groups}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[12px] text-muted-foreground">
          {t("Faqat buyumlar tannarxi hisoblanadi (xizmat va chegirma kirmaydi). Byudjet tugasa buyum berilmaydi.")}
        </p>
      </div>
    </div>
  );
}
