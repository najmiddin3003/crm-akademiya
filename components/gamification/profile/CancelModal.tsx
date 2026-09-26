"use client";

import { useEffect, useState } from "react";
import Modal, { useModalClose } from "@/components/ui/Modal";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useT } from "@/components/shared/Language";
import { gamApi } from "../api";
import { btnDanger, btnGhost, FieldError, fmtDate, inputCls, signed } from "../ui";

// «Yozuvni bekor qilish» (storno, TZ 4.11.4, 10). Forma oynasi — faqat
// «Yopish» bilan yopiladi (Esc/fon — yo'q). Natija oldindan ko'rsatiladi:
// balans X → Y, kechiriladigan qism (faqat direktor), daraja o'zgarishi.
// Tanga sarflangan bo'lsa admin va ustozga oyna bloklanadi va sababini yozadi.

interface Preview {
  pupilName: string;
  tx: { id: number; date: string; label: string; amount: number; applied: number };
  allowed: boolean;
  spent: boolean;
  message: string | null;
  balanceBefore?: number;
  balanceAfter?: number;
  notRecovered?: number;
  levelBefore?: string;
  levelAfter?: string;
}

export default function CancelModal({
  txId,
  onClose,
  onDone,
}: {
  txId: number;
  onClose: () => void;
  onDone: (balance: number) => void;
}) {
  const { t } = useT();
  const modal = useModalClose(onClose);
  const [pv, setPv] = useState<Preview | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    gamApi<Preview>(`/api/gamification/transactions/${txId}/cancel-preview`).then((res) => {
      if (!alive) return;
      if (res.ok) setPv(res);
      else setLoadErr(res.error);
    });
    return () => {
      alive = false;
    };
  }, [txId]);

  async function submit() {
    if (!pv?.allowed || busy) return;
    if (!note.trim()) {
      setErr(t("Izoh yozish majburiy"));
      return;
    }
    setBusy(true);
    const res = await gamApi<{ balance: number }>(`/api/gamification/transactions/${txId}/cancel`, { method: "POST", body: { note: note.trim() } });
    setBusy(false);
    if (!res.ok) {
      setErr(t(res.error));
      return;
    }
    onDone(res.balance);
    modal.close();
  }

  const blocked = !!pv && !pv.allowed;
  const levelDown = !!pv && pv.levelBefore !== undefined && pv.levelBefore !== pv.levelAfter;

  return (
    <Modal onClose={onClose} controller={modal} bare locked size="md" zIndex={130} panelClassName="overflow-y-auto">
      <div className="gm-page p-5">
        <h2 className="text-[17px] font-semibold">{t("Yozuvni bekor qilish")}</h2>
        {!pv && !loadErr && <SpinnerBlock />}
        {loadErr && <div className="mt-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[13px]">{t(loadErr)}</div>}
        {pv && (
          <>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              {pv.pupilName} · {t(pv.tx.label)} · {fmtDate(pv.tx.date)} · <b>{signed(pv.tx.amount)}</b>
            </p>
            {pv.spent && !pv.allowed ? (
              <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[13px] leading-relaxed">
                {t("O'quvchi bu tangalarni sarflagan (balans {balance}, bekor qilinadigan {applied}) — bekor qilish uchun direktorga murojaat qiling.", {
                  balance: pv.balanceBefore ?? 0,
                  applied: pv.tx.applied,
                })}
              </div>
            ) : blocked ? (
              <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[13px]">{t(pv.message ?? "")}</div>
            ) : (
              <div
                className={`mt-3 rounded-xl border px-3 py-2 text-[13px] leading-relaxed ${
                  pv.notRecovered || levelDown ? "border-amber-500/40 bg-amber-500/10" : "border-border bg-secondary/50"
                }`}
              >
                {t("Balans")}: <b>{pv.balanceBefore} → {pv.balanceAfter}</b>.{" "}
                {!!pv.notRecovered &&
                  t(
                    "O'quvchi bu tangalarning bir qismini sarflab bo'lgan — balans 0 dan pastga tushmaydi, {n} tanga kechiriladi. Diqqat: sovg'a keyin qaytarilsa, narxi to'liq qaytadi. Avval sovg'ani qaytarsangiz, kechirish kerak bo'lmaydi.",
                    { n: pv.notRecovered },
                  )}
                {levelDown && <> {t("Daraja: «{from}» → «{to}».", { from: t(pv.levelBefore ?? ""), to: t(pv.levelAfter ?? "") })}</>}
              </div>
            )}
            <div className="mt-4">
              <label htmlFor="cNote" className="mb-1 block text-[12px] font-semibold text-muted-foreground">
                {t("Bekor qilish izohi (majburiy)")}
              </label>
              <textarea
                id="cNote"
                rows={3}
                value={note}
                maxLength={500}
                disabled={blocked}
                aria-invalid={!!err}
                placeholder={t("Masalan: ota-ona e'tirozi, ustoz xato bosgan")}
                onChange={(e) => {
                  setNote(e.target.value);
                  setErr("");
                }}
                className={`${inputCls} h-auto py-2`}
              />
              <FieldError text={err} />
            </div>
            <p className="mt-2 text-[12px] text-muted-foreground">{t("Yozuv o'chmaydi — tarixda chizilgan holda «bekor qilindi» belgisi bilan qoladi.")}</p>
          </>
        )}
        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <button type="button" className={btnGhost} onClick={modal.close} disabled={busy}>
            {t("Yopish")}
          </button>
          <button type="button" className={btnDanger} onClick={submit} disabled={busy || !pv?.allowed}>
            {busy ? t("Saqlanmoqda…") : t("Yozuvni bekor qilish")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
