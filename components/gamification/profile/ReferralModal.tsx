"use client";

import { useEffect, useState } from "react";
import Modal, { useModalClose } from "@/components/ui/Modal";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useT } from "@/components/shared/Language";
import { gamApi } from "../api";
import { btnGhost, btnPrimary, Chip, FieldError } from "../ui";

// «Do'st olib keldi» (TZ 4.12, prototipdagi dostModal). Ro'yxatda faqat shu
// o'quvchi tavsiya qilgan lidlar (lid filialidan qat'i nazar); shartga
// mosi tanlanadi. Bonus guruhsiz — reytingga kirmaydi.

type State = "ok" | "given" | "no_payment" | "not_in_group";
interface Lead {
  id: number;
  name: string;
  course: string;
  holat: string;
  state: State;
}

export interface ReferralDone {
  txId: number;
  amount: number;
  leadName: string;
  levelUp: { name: string } | null;
  badges: { name: string }[];
}

export default function ReferralModal({
  pupilId,
  pupilName,
  bonus,
  onClose,
  onDone,
}: {
  pupilId: number;
  pupilName: string;
  bonus: number;
  onClose: () => void;
  onDone: (res: ReferralDone) => void;
}) {
  const { t } = useT();
  const modal = useModalClose(onClose);
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [pick, setPick] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    gamApi<{ leads: Lead[] }>(`/api/gamification/students/${pupilId}/referral-leads`).then((res) => {
      if (!alive) return;
      if (!res.ok) {
        setErr(t(res.error));
        setLeads([]);
        return;
      }
      setLeads(res.leads);
      const ok = res.leads.filter((l) => l.state === "ok");
      if (ok.length === 1) setPick(ok[0].id);
    });
    return () => {
      alive = false;
    };
  }, [pupilId, t]);

  async function submit() {
    if (pick === null || busy) return;
    setBusy(true);
    const res = await gamApi<{ txId: number; amount: number; levelUp: { name: string } | null; badges: { name: string }[] }>("/api/gamification/referral", {
      method: "POST",
      body: { pupilId, leadId: pick },
    });
    setBusy(false);
    if (!res.ok) {
      setErr(t(res.error));
      return;
    }
    onDone({ txId: res.txId, amount: res.amount, leadName: leads?.find((l) => l.id === pick)?.name ?? "", levelUp: res.levelUp, badges: res.badges ?? [] });
    modal.close();
  }

  const chip = (l: Lead) =>
    l.state === "given" ? (
      <Chip tone="g">{t("bonus berilgan")}</Chip>
    ) : l.state === "no_payment" ? (
      <Chip tone="a">{t("to'lov yo'q")}</Chip>
    ) : l.state === "not_in_group" ? (
      <Chip tone="m">{t("hali guruhda emas")}</Chip>
    ) : (
      <Chip tone="b">{t("bonus berish mumkin")}</Chip>
    );

  return (
    <Modal onClose={onClose} controller={modal} bare locked size="md" zIndex={130} panelClassName="overflow-y-auto">
      <div className="gm-page p-5">
        <h2 className="text-[17px] font-semibold">{t("Do'st olib keldi")}</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
          {t(
            "{name} tavsiya qilgan lidlar — Lidlar bo'limidagi «Referal bergan o'quvchi» maydoni bo'yicha. +{bonus} tanga faqat do'st to'lov qilib guruhga qo'shilgandan keyin, har bir lid uchun bir marta beriladi.",
            { name: pupilName, bonus },
          )}
        </p>
        <div className="mt-4">
          {leads === null ? (
            <SpinnerBlock />
          ) : leads.length === 0 ? (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[13px]">
              {t("Bu o'quvchi tavsiya qilgan lid yo'q. Lid qo'shilayotganda «Referal bergan o'quvchi» maydonida shu o'quvchi tanlanishi kerak.")}
            </div>
          ) : (
            <div role="radiogroup" className="space-y-2">
              {leads.map((l) => {
                const ok = l.state === "ok";
                return (
                  <label
                    key={l.id}
                    className={`gm-tap flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                      ok ? "cursor-pointer border-border hover:bg-secondary/50" : "cursor-not-allowed border-border/60 opacity-60"
                    } ${pick === l.id ? "ring-2 ring-primary/50" : ""}`}
                  >
                    <input type="radio" name="gmLead" disabled={!ok} checked={pick === l.id} onChange={() => setPick(l.id)} />
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[13.5px]">{l.name}</b>
                      <span className="text-[12px] text-muted-foreground">
                        {l.course ? `${l.course} · ` : ""}
                        {t(l.holat)}
                      </span>
                    </span>
                    {chip(l)}
                  </label>
                );
              })}
            </div>
          )}
          <FieldError text={err} />
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <button type="button" className={btnGhost} onClick={modal.close} disabled={busy}>
            {t("Bekor")}
          </button>
          <button type="button" className={btnPrimary} onClick={submit} disabled={busy || pick === null}>
            {busy ? t("Saqlanmoqda…") : t("+{n} yozish", { n: bonus })}
          </button>
        </div>
      </div>
    </Modal>
  );
}
