"use client";

import { useRef, useState } from "react";
import { CircleX, Loader2 } from "lucide-react";
import { useModalClose } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/shared/Language";
import { postHolat } from "@/components/leads/LeadHolatModals";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { FieldError, TextInput, fieldCls } from "@/components/v2/form/fields";
import { secondaryBtn } from "@/components/v2/ui/buttons";
import type { Order } from "@/lib/ordersData";
import { phoneParts } from "./leadUtils";

// YANGI VERSIYA — «RAD ETISH» (lid panelidagi «⊗ Rad etdi»; 40-qism rasmi «Lid · «Rad etdi» sababi · Telefon»:
// sabablar — radio qatorlar, ixtiyoriy izoh, qizil «Rad etildi»; telefonda pastdan chiqadigan oyna — V2Dialog). Sabablar — Sozlamalar → Lidlar ro'yxatidan (eski
// oyna bilan bir xil), «Boshqa sabab» — matn. Eski oynada sabab bosilishi bilan
// saqlanardi; bu yerda tanlanadi va qizil «Rad etish» bilan tasdiqlanadi.
// So'rov — eski oyna bilan BITTA: POST /api/orders/:id/holat { to: "rad", radSabab }.

const OTHER = "__other__";

export default function LeadRadModalV2({
  order,
  reasons,
  onClose,
  onDone,
  onConflict,
}: {
  order: Order;
  reasons: string[];
  onClose: () => void;
  onDone: (order: Order, message: string) => void;
  onConflict: () => void;
}) {
  const { t } = useT();
  const { showToast } = useToast();
  const modal = useModalClose(onClose, "center");
  const [pick, setPick] = useState<string>("");
  const [other, setOther] = useState("");
  // Ixtiyoriy izoh — rad etilgach lidning izohlariga yoziladi (POST /api/orders/:id/comments).
  const [izoh, setIzoh] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const otherRef = useRef<HTMLInputElement>(null);

  const sabab = pick === OTHER ? other.trim() : pick;
  const err = !sabab ? (pick === OTHER ? t("Sababni yozing") : t("Rad etish sababini tanlang")) : "";

  async function submit() {
    if (busy) return;
    setSubmitted(true);
    if (err) return;
    setBusy(true);
    const r = await postHolat(order.id, { to: "rad", radSabab: sabab });
    setBusy(false);
    if (!r.ok) {
      showToast({ tone: "error", title: t("Saqlab bo'lmadi"), detail: t(r.error) });
      if (/o'zgargan/.test(r.error)) onConflict();
      return;
    }
    if (izoh.trim())
      await fetch(`/api/orders/${order.id}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: izoh.trim() }) }).catch(() => null);
    onDone(r.order, t("Rad etildi"));
    modal.close();
  }

  const phone = phoneParts(order.phone)?.show ?? order.phone;
  return (
    <V2Dialog
      title={t("Rad etdi")}
      subtitle={[order.name, phone].filter(Boolean).join(" · ")}
      onClose={onClose}
      controller={modal}
      dirty={!!pick}
      saving={busy}
      width={480}
      onSubmit={() => void submit()}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={busy} className={`${secondaryBtn} h-10 justify-center`}>
            {t("Bekor qilish")}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-v2-md bg-v2-danger px-4 text-v2-body font-semibold text-v2-on-danger transition-[filter] hover:brightness-95 focus-visible:shadow-v2-focus focus-visible:outline-none disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CircleX className="size-4" strokeWidth={2} aria-hidden />}
            {busy ? t("Saqlanmoqda...") : t("Rad etildi")}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-v2-small text-v2-text-2">{t("Sababni tanlang — Sotuv voronkasida shu sabab bilan hisoblanadi")}</p>
          <div role="radiogroup" aria-label={t("Sabab")} className="space-y-2">
            {[...reasons, OTHER].map((s) => {
              const on = pick === s;
              return (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    setPick(s);
                    if (s === OTHER) requestAnimationFrame(() => otherRef.current?.focus());
                  }}
                  className={`flex w-full items-center gap-3 rounded-v2-md border px-3 py-2.5 text-left text-v2-body font-medium transition-colors ${on ? "border-v2-brand bg-v2-brand-bg text-v2-text" : "border-v2-border bg-v2-surface text-v2-text hover:bg-v2-surface-2"}`}
                >
                  <span className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-v2-brand" : "border-v2-border-strong"}`}>{on && <span className="size-2.5 rounded-full bg-v2-brand" />}</span>
                  {s === OTHER ? t("Boshqa sabab") : t(s)}
                </button>
              );
            })}
          </div>
          {submitted && err && pick !== OTHER && <FieldError>{err}</FieldError>}
        </div>
        {pick === OTHER && (
          <div>
            <TextInput
              ref={otherRef}
              value={other}
              maxLength={200}
              onChange={(e) => setOther(e.target.value)}
              placeholder={t("Sababni yozing")}
              aria-label={t("Boshqa sabab")}
              state={submitted && err ? "error" : "default"}
            />
            {submitted && err && <FieldError>{err}</FieldError>}
          </div>
        )}
        <div>
          <label htmlFor="rad-izoh" className="mb-1.5 block text-v2-small font-medium text-v2-text-2">
            {t("Izoh (ixtiyoriy)")}
          </label>
          <textarea id="rad-izoh" value={izoh} onChange={(e) => setIzoh(e.target.value)} rows={2} maxLength={500} placeholder={t("Masalan: yanvarda qayta qo'ng'iroq")} className={fieldCls("default", "h-auto py-2")} />
        </div>
        <p className="text-v2-caption text-v2-text-3">{t("Rad etilgan lid bilan keyin qayta bog'lanish mumkin — tarixda qoladi.")}</p>
      </div>
    </V2Dialog>
  );
}
