"use client";

import "../gamification.css";
import { useCallback, useEffect, useState } from "react";
import { SpinnerBlock } from "@/components/ui/Spinner";
import Select from "@/components/ui/Select";
import Modal, { useModalClose } from "@/components/ui/Modal";
import { useLang, useT } from "@/components/shared/Language";
import { MONTHS } from "@/lib/i18n";
import type { GamRole } from "@/lib/gamification/types";
import { gamApi } from "../api";
import { btnGhost, btnPrimary, cardCls, Chip, FieldError, Signed, useGamToast } from "../ui";

// Gamifikatsiya → Guruhlar musobaqasi (TZ 4.20, 5.6). Har filial alohida
// kartada: guruh o'rtachasi (faol a'zolar reyting tangasi / soni) bo'yicha
// o'rin. Yetakchi — «🏆 Hozircha 1-o'rinda»; o'tgan oy g'olibi alohida.
// Direktorda «Oyni yakunlash» (o'tgan oy hali yakunlanmagan bo'lsa).

interface Group {
  id: number;
  label: string;
  teacher: string;
  members: number;
  total: number;
  avg: number;
  rank: number;
}
interface View {
  enabled: boolean;
  role: GamRole;
  month: string;
  currentMonth: string;
  monthCloseDay: number;
  closed: boolean;
  canClose: boolean;
  closeMonth: string;
  branchOptions: { id: number; name: string }[];
  branches: { id: number; name: string; groups: Group[]; lastWinners: string[] }[];
}

const PAGE = "gm-page container mx-auto max-w-[1900px] space-y-4 p-4 md:p-5";

function CloseMonthModal({ month, label, onClose, onDone }: { month: string; label: string; onClose: () => void; onDone: (msg: string) => void }) {
  const { t } = useT();
  const modal = useModalClose(onClose);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function go() {
    setBusy(true);
    const res = await gamApi<{ groups: number; winners: number; studentsOfMonth: number; onTime: number }>("/api/gamification/month-close", {
      method: "POST",
      body: { month },
    });
    setBusy(false);
    if (!res.ok) {
      setErr(t(res.error));
      return;
    }
    onDone(t("{month} yakunlandi: {groups} ta guruh, {winners} ta g'olib, «Oy o'quvchisi» — {som}", { month: label, groups: res.groups, winners: res.winners, som: res.studentsOfMonth }));
    modal.close();
  }
  return (
    <Modal onClose={onClose} controller={modal} bare locked size="md" panelClassName="overflow-y-auto">
      <div className="gm-page p-5">
        <h2 className="text-[17px] font-semibold">{t("Oyni yakunlash")}</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          {t(
            "{month} natijalari muzlatiladi: har filialda g'olib guruh(lar), har guruhda «Oy o'quvchisi» va «Aniq vaqt» nishonlari yoziladi. Keyingi tuzatishlar (storno, kechikkan Sarhisob) bu natijalarni o'zgartirmaydi. Oyni faqat bir marta yakunlash mumkin.",
            { month: label },
          )}
        </p>
        <FieldError text={err} />
        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <button type="button" className={btnGhost} onClick={modal.close} disabled={busy}>
            {t("Bekor")}
          </button>
          <button type="button" className={btnPrimary} onClick={go} disabled={busy}>
            {busy ? t("Saqlanmoqda…") : t("Yakunlash")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function CompetitionPage() {
  const { t } = useT();
  const [lang] = useLang();
  const [toastNode, toast] = useGamToast();
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState("");
  const [branch, setBranch] = useState("");
  const [closing, setClosing] = useState(false);

  const load = useCallback(
    (b: string) =>
      gamApi<View>(b ? `/api/gamification/competition?branchId=${b}` : "/api/gamification/competition").then((res) => {
        if (!res.ok) setError(res.error);
        else {
          setError("");
          setView(res);
        }
      }),
    [],
  );
  useEffect(() => {
    void load("");
  }, [load]);

  const monthName = (m: string) => (MONTHS[lang] ?? MONTHS.uz)[Number(m.slice(5, 7)) - 1] ?? m;

  if (error && !view) {
    return (
      <div className={PAGE}>
        <h1 className="text-xl font-semibold">{t("Guruhlar musobaqasi")}</h1>
        <div className={`${cardCls} text-sm text-muted-foreground`}>{t(error)}</div>
      </div>
    );
  }
  if (!view) return <div className={PAGE}><SpinnerBlock /></div>;
  const [y, m] = view.currentMonth.split("-").map(Number);
  const nextMonth = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}`;

  return (
    <div className={PAGE}>
      {toastNode}
      <div>
        <h1 className="text-xl font-semibold">{t("Guruhlar musobaqasi")}</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
          {t("Har filialda guruhlar o'rtacha reyting tangasi bo'yicha bellashadi: guruh a'zolarining shu oydagi reyting tangalari yig'indisi ÷ a'zolar soni. Oy g'olibi jamoaviy mukofot oladi.")}
        </p>
      </div>
      <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-[13px]">
        {t("Natijalar oy tugagach — {day}-{month} kuni tunda avtomatik qayd etiladi.", {
          day: view.monthCloseDay,
          month: monthName(nextMonth).toLowerCase(),
        })}
      </div>
      {(view.branchOptions.length > 1 || view.canClose) && (
        <div className={cardCls}>
          <div className="flex flex-wrap items-center gap-2">
            {view.branchOptions.length > 1 && (
              <div className="w-full sm:w-72">
                <Select
                  value={branch}
                  onChange={(v) => {
                    setBranch(v);
                    void load(v);
                  }}
                  options={view.branchOptions.map((b) => ({ value: String(b.id), label: b.name }))}
                  placeholder={t("Barcha filiallar")}
                  clearable
                  size="md"
                />
              </div>
            )}
            {view.canClose && (
              <button type="button" className={`${btnPrimary} sm:ml-auto`} onClick={() => setClosing(true)}>
                {t("Oyni yakunlash")} · {monthName(view.closeMonth)}
              </button>
            )}
          </div>
        </div>
      )}
      {view.branches.length === 0 ? (
        <div className={`${cardCls} text-sm text-muted-foreground`}>{t("Musobaqada qatnashadigan guruh yo'q.")}</div>
      ) : (
        view.branches.map((b) => (
          <section key={b.id} className={`${cardCls} space-y-3`}>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[16px] font-semibold">{b.name}</h2>
              <span className="text-[12.5px] text-muted-foreground">· {monthName(view.month)}</span>
              {b.lastWinners.length > 0 && (
                <span className="ml-auto text-[12.5px] text-muted-foreground">
                  {t("O'tgan oy g'olibi")}: <b className="text-foreground">{b.lastWinners.join(", ")}</b>
                </span>
              )}
            </div>
            {b.groups.length === 0 ? (
              <div className="text-[13px] text-muted-foreground">{t("Bu oyda faol guruh yo'q.")}</div>
            ) : (
              <div className="gm-scroll-card overflow-x-auto rounded-xl border border-border">
                <table className="gm-table">
                  <thead>
                    <tr>
                      <th>{t("O'rin")}</th>
                      <th>{t("Guruh")}</th>
                      <th>{t("Ustoz")}</th>
                      <th>{t("O'quvchilar")}</th>
                      <th>{t("Jami reyting tangasi")}</th>
                      <th>{t("O'rtacha")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {b.groups.map((g) => (
                      <tr key={g.id}>
                        <td data-l={t("O'rin")}>
                          <b>{g.rank}</b>
                        </td>
                        <td data-l="" className="gm-lead">
                          <b>{g.label}</b>
                          {g.rank === 1 && g.avg > 0 && view.month === view.currentMonth && (
                            <span className="ml-2">
                              <Chip tone="a">🏆 {t("Hozircha 1-o'rinda")}</Chip>
                            </span>
                          )}
                        </td>
                        <td data-l={t("Ustoz")} className="text-[12.5px]">
                          {g.teacher || "—"}
                        </td>
                        <td data-l={t("O'quvchilar")}>{g.members}</td>
                        <td data-l={t("Jami reyting tangasi")}>
                          <Signed n={g.total} />
                        </td>
                        <td data-l={t("O'rtacha")}>
                          <b className="tabular-nums">{g.avg}</b>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))
      )}
      {closing && (
        <CloseMonthModal
          month={view.closeMonth}
          label={monthName(view.closeMonth)}
          onClose={() => setClosing(false)}
          onDone={(msg) => {
            toast(msg);
            void load(branch);
          }}
        />
      )}
    </div>
  );
}
