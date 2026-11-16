"use client";

import { useEffect, useMemo, useState } from "react";
import { Send } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { Field, fieldCls } from "@/components/v2/form/fields";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { renderSmsPreview, type SmsTemplate } from "@/lib/smsTemplates";
import { fmtPhone } from "./listKit";

// YANGI VERSIYA — BIR NECHA KISHIGA SMS (30-qism): «Eslatma yuborish · N SMS» (Obunasi
// tugaydiganlar) va «Kabinetga taklif» (Ota-ona). Har qabul qiluvchiga alohida
// POST /api/sms-messages — har biri SMS jurnaliga yoziladi (o'quvchi profilidagi SMS oynasi
// bilan bir xil yo'l). Matndagi {name}, {amount}, {date}, {link} har qabul qiluvchi uchun
// almashtiriladi. Shablon — Sotuv va marketing → SMS shablonlari.

export interface SmsRecipient {
  /** Kalit (o'quvchi id yoki ota-ona telefoni). */
  key: string;
  /** Kimga (jurnalda): «Akbar Tojiboyev — ota-onasi». */
  label: string;
  phone: string;
  /** Matndagi o'rinbosarlar. */
  values: Record<string, string>;
}

export default function BulkSmsDialogV2({
  title,
  subtitle,
  recipients,
  defaultText,
  submitLabel,
  onClose,
  onDone,
}: {
  title: string;
  subtitle: string;
  recipients: SmsRecipient[];
  defaultText: string;
  submitLabel: (n: number) => string;
  onClose: () => void;
  /** Yuborilganlar (kalitlari) — sahifa holatni yangilaydi. */
  onDone: (sentKeys: string[], simulated: boolean) => void;
}) {
  const { t } = useT();
  const { showError } = useToast();
  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [tpl, setTpl] = useState("");
  const [text, setText] = useState(defaultText);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(0);

  useEffect(() => {
    let off = false;
    fetch("/api/sms-templates")
      .then((r) => r.json())
      .then((j) => {
        if (!off && j?.ok) setTemplates((j.templates as SmsTemplate[]).filter((x) => x.text?.trim()));
      })
      .catch(() => {});
    return () => {
      off = true;
    };
  }, []);

  const valid = useMemo(() => recipients.filter((r) => r.phone.replace(/\D/g, "").length >= 9), [recipients]);
  const sample = valid[0];

  async function send(close: () => void) {
    const body = text.trim();
    if (!body) {
      showError(t("Xabar matnini kiriting"));
      return;
    }
    setSending(true);
    const sent: string[] = [];
    let simulated = false;
    for (const r of valid) {
      const res = await fetch("/api/sms-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: r.phone, text: renderSmsPreview(body, r.values), recipientName: r.label }),
      })
        .then((x) => x.json())
        .catch(() => null);
      if (!res?.ok) {
        setSending(false);
        showError(res?.error || t("SMS yuborishda xatolik yuz berdi — {name}", { name: r.label }));
        if (sent.length) onDone(sent, simulated);
        return;
      }
      simulated = simulated || Boolean(res.simulated);
      sent.push(r.key);
      setDone(sent.length);
    }
    setSending(false);
    onDone(sent, simulated);
    close();
  }

  return (
    <V2Dialog
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      saving={sending}
      dirty={text !== defaultText}
      width={560}
      footerStart={
        <span className="text-v2-caption text-v2-text-3">
          {sending ? t("Yuborilmoqda: {done} / {n}", { done, n: valid.length }) : t("{n} ta raqam", { n: valid.length })}
        </span>
      }
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={sending} className={secondaryBtn}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void send(api.close)} disabled={sending || valid.length === 0} className={`${primaryBtn} disabled:opacity-50`}>
            <Send className="size-4" strokeWidth={2} aria-hidden />
            {submitLabel(valid.length)}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <Field label={t("Kimlarga")}>
          <div className="max-h-36 overflow-y-auto rounded-v2-md border border-v2-border bg-v2-surface-2 px-3 py-2 text-v2-small">
            {recipients.map((r) => {
              const ok = r.phone.replace(/\D/g, "").length >= 9;
              return (
                <div key={r.key} className="flex items-center justify-between gap-3 py-0.5">
                  <span className="truncate text-v2-text">{r.label}</span>
                  <span className={`shrink-0 tabular-nums ${ok ? "text-v2-text-2" : "text-v2-danger"}`}>{ok ? fmtPhone(r.phone) : t("raqam yo'q")}</span>
                </div>
              );
            })}
          </div>
        </Field>
        {templates.length > 0 && (
          <Field label={t("Shablon")} optional>
            <V2Select
              label={t("Shablon")}
              placeholder={t("Tanlang")}
              value={tpl}
              onChange={(v) => {
                setTpl(v);
                const found = templates.find((x) => String(x.id) === v);
                if (found) setText(found.text);
              }}
              options={templates.map((x) => ({ value: String(x.id), label: x.title, hint: x.audience }))}
            />
          </Field>
        )}
        <Field label={t("Xabar matni")} hint={t("{name} — o'quvchi ismi, {amount} — summa, {date} — sana, {link} — kabinet havolasi")}>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className={fieldCls("default", "h-auto! py-2 leading-5")} />
        </Field>
        {sample && (
          <div className="rounded-v2-md border border-v2-border bg-v2-surface-2 px-3 py-2 text-v2-small text-v2-text-2">
            <div className="mb-1 text-v2-caption text-v2-text-3">{t("Namuna — {name}", { name: sample.label })}</div>
            <div className="whitespace-pre-wrap text-v2-text">{renderSmsPreview(text, sample.values)}</div>
          </div>
        )}
      </div>
    </V2Dialog>
  );
}
