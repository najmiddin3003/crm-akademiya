"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import { renderSmsPreview, type SmsTemplate } from "@/lib/smsTemplates";
import { AUTO_SMS_SCENARIOS } from "@/constants/settingsAutoSms";
import { pupilFullName, type Pupil } from "@/lib/pupilsData";
import { loadPupilsCached } from "@/hooks/useStudents";
import { selectPlaceholder } from "@/lib/selectPlaceholder";

// "SMS yuborish" tugmasi bosilganda ochiladigan modal (OrderDetailPage.tsx) —
// akademiya.edutizim.uz referensiga mos: O'quvchilar (faqat ko'rsatiladi) →
// Ota onaga / Faqat ota-onaga tugmachalari → SMS shablon → Xabar →
// belgilar hisoblagichi → Orqaga / Saqlash.
//
// SHABLONLAR ikki manbadan yig'iladi (foydalanuvchi ikkalasini ham "shablon"
// deb ataydi), ro'yxatda qaysi biridan kelgani optgroup bilan ajratiladi:
//   1) Sotuv va marketing → SMS shablonlari  (/api/sms-templates)
//   2) Sozlamalar → Sotuv va marketing → Avto sms  (settings:
//      "sale-marketing.auto-sms" — matni to'ldirilgan hodisalar)
// Shablon tanlansa matni "Xabar" maydoniga tushadi; {name} kabi o'rinbosarlar
// o'quvchi ismiga almashtiriladi.
//
// "Ota onaga" / "Faqat ota-onaga" tugmachalari ILGARI YOLG'ON edi: holatlari
// hech qayerda o'qilmasdi, POST tanasida faqat o'quvchining o'z raqami ketardi,
// ya'ni tugmachani bosish hech narsani o'zgartirmasdi. Endi ota-ona raqamlari
// HAQIQIY manbadan olinadi — /api/pupils dagi `fatherPhone` va `motherPhone`
// (lib/pupilsData.ts). Modal faqat `studentName` va `phone` propslarini oladi
// (chaqiruvchilar: OrderDetailPage, StudentsListPage), shu bois o'quvchini
// ro'yxatdan o'zi topadi — avval telefon bo'yicha, bo'lmasa to'liq ism bo'yicha
// (lib/enrollStudent.ts dagi findPupilForOrder bilan bir xil qoida).
// O'quvchi topilmasa yoki ota-ona raqami yozilmagan bo'lsa tugmachalar
// O'CHIRILADI — mavjud bo'lmagan qabul qiluvchini va'da qilmaslik uchun.

export interface SmsModalProps {
  /** Kimga yuborilishi — sarlavha ostida ko'rsatiladi. */
  studentName: string;
  /** Qaysi raqamga yuboriladi. */
  phone: string;
  onClose: () => void;
  onSent: (info: { simulated: boolean }) => void;
  onError: (message: string) => void;
}

interface TemplateOption {
  /** <select> qiymati — manba + kalit. */
  value: string;
  label: string;
  text: string;
  group: string;
}

const FIELD_CLS =
  "w-full h-11 rounded-lg border border-border bg-secondary/20 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

/** Bitta qabul qiluvchi — jurnalda ham shu nom bilan ko'rinadi. */
interface Recipient {
  phone: string;
  name: string;
}

const digitsOf = (s: string) => (s || "").replace(/\D/g, "");

function Toggle({
  on,
  onChange,
  label,
  disabled,
  title,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <div className={`flex items-center gap-2 ${disabled ? "opacity-50" : ""}`} title={title}>
      <span className="text-sm">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!on)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-primary" : "bg-secondary"} ${disabled ? "cursor-not-allowed" : ""}`}
      >
        <span className="absolute top-1 h-4 w-4 rounded-full bg-white transition-all" style={{ left: on ? 26 : 4 }} />
      </button>
    </div>
  );
}

export default function SmsModal({ studentName, phone, onClose, onSent, onError }: SmsModalProps) {
  const [options, setOptions] = useState<TemplateOption[]>([]);
  // Shablonlar ikki manbadan yig'ilib bo'lguncha ro'yxat bo'sh turadi — o'sha
  // paytda "Shablon yo'q" deyish YOLG'ON bo'lardi.
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [picked, setPicked] = useState("");
  const [toParent, setToParent] = useState(false);
  const [onlyParent, setOnlyParent] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [parentPhones, setParentPhones] = useState<Recipient[]>([]);
  useEscapeClose(onClose);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/sms-templates").then((r) => r.json()).catch(() => null),
      fetch("/api/settings?key=sale-marketing.auto-sms").then((r) => r.json()).catch(() => null),
      // Ota/ona telefonlari kerak -> to'liq hujjatlar (lekin umumiy keshdan).
      loadPupilsCached<"fatherPhone" | "motherPhone">({ extra: ["fatherPhone", "motherPhone"] })
        .then((pupils) => ({ ok: true, pupils }))
        .catch(() => null),
    ]).then(([tplRes, autoRes, pupilRes]) => {
      if (cancelled) return;
      const list: TemplateOption[] = [];

      if (tplRes?.ok) {
        for (const t of tplRes.templates as SmsTemplate[]) {
          if (t.text?.trim()) list.push({ value: `tpl:${t.id}`, label: t.title, text: t.text, group: "SMS shablonlari" });
        }
      }

      // Avto sms: har bir hodisaning matni to'ldirilgan bo'lsa shablon sifatida.
      const scenarios = (autoRes?.ok ? autoRes.values?.scenarios : null) as
        | Record<string, { text?: string }>
        | undefined;
      if (scenarios) {
        for (const s of AUTO_SMS_SCENARIOS) {
          const body = scenarios[s.key]?.text?.trim();
          if (body) list.push({ value: `auto:${s.key}`, label: s.title, text: body, group: "Avto sms" });
        }
      }

      setOptions(list);

      // Ota-ona raqamlari — o'quvchi kartochkasidan (fatherPhone/motherPhone).
      if (pupilRes?.ok) {
        const pupils = pupilRes.pupils as Pupil[];
        const wantedDigits = digitsOf(phone);
        const wantedName = studentName.trim().toLowerCase();
        const pupil =
          (wantedDigits ? pupils.find((p) => digitsOf(p.phone) === wantedDigits) : undefined) ??
          pupils.find((p) => pupilFullName(p).toLowerCase() === wantedName);
        const found: Recipient[] = [];
        if (pupil?.fatherPhone?.trim()) found.push({ phone: pupil.fatherPhone.trim(), name: `${studentName} — otasi` });
        if (pupil?.motherPhone?.trim()) found.push({ phone: pupil.motherPhone.trim(), name: `${studentName} — onasi` });
        // Ota va ona bir xil raqam yozgan bo'lsa SMS ikki marta ketmasin.
        setParentPhones(found.filter((r, i) => found.findIndex((x) => digitsOf(x.phone) === digitsOf(r.phone)) === i));
      }
    }).finally(() => {
      if (!cancelled) setTemplatesLoading(false);
    });
    return () => { cancelled = true; };
  }, [phone, studentName]);

  const pick = (value: string) => {
    setPicked(value);
    const opt = options.find((o) => o.value === value);
    // Shablon tanlansa matni maydonga tushadi (o'rinbosarlar almashtirilgan
    // holda); keyin uni qo'lda tahrirlash mumkin.
    if (opt) setText(renderSmsPreview(opt.text, { name: studentName }));
  };

  const groups = Array.from(new Set(options.map((o) => o.group)));

  const hasParents = parentPhones.length > 0;
  // Tugmachalarning MA'NOSI: "Ota onaga" — o'quvchi bilan birga ota-onaga ham;
  // "Faqat ota-onaga" — o'quvchiga umuman yubormaslik. Ikkinchisi birinchisini
  // qamrab oladi, shuning uchun quyida `onlyParent` ustunlik qiladi.
  const recipients: Recipient[] = [
    ...(!onlyParent && phone.trim() ? [{ phone: phone.trim(), name: studentName }] : []),
    ...(toParent || onlyParent ? parentPhones : []),
  ];

  const send = async () => {
    const body = text.trim();
    if (!body) {
      onError("Xabar matnini kiriting");
      return;
    }
    if (recipients.length === 0) {
      onError("Yuborish uchun telefon raqam yo'q");
      return;
    }
    setSending(true);
    // Har bir qabul qiluvchiga alohida so'rov — /api/sms-messages bitta
    // raqamni qabul qiladi va har bir yuborishni jurnalga alohida yozadi.
    let simulated = false;
    for (const r of recipients) {
      const res = await fetch("/api/sms-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: r.phone, text: body, recipientName: r.name }),
      })
        .then((x) => x.json())
        .catch(() => null);
      if (!res?.ok) {
        setSending(false);
        onError(res?.error || `SMS yuborishda xatolik yuz berdi — ${r.name}`);
        return;
      }
      simulated = simulated || Boolean(res.simulated);
    }
    setSending(false);
    onSent({ simulated });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 pb-4 text-center">
          <h3 className="text-xl font-semibold">SMS yuborish</h3>
        </div>

        <div className="px-5 pb-5 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">O&apos;quvchilar</label>
            <p className="text-sm text-muted-foreground">{studentName}</p>
          </div>

          <div className="flex items-center gap-6">
            <Toggle
              label="Ota onaga"
              on={toParent}
              onChange={setToParent}
              disabled={!hasParents}
              title={hasParents ? undefined : "O'quvchi kartochkasida ota-ona telefoni yozilmagan"}
            />
            <Toggle
              label="Faqat ota-onaga"
              on={onlyParent}
              onChange={setOnlyParent}
              disabled={!hasParents}
              title={hasParents ? undefined : "O'quvchi kartochkasida ota-ona telefoni yozilmagan"}
            />
          </div>

          {/* Qaysi raqamlarga ketishi OCHIQ ko'rsatiladi — tugmachalar endi
              haqiqatan qabul qiluvchilar ro'yxatini o'zgartiradi. */}
          <div className="text-[12px] text-muted-foreground">
            {recipients.length > 0
              ? `Yuboriladi: ${recipients.map((r) => r.phone).join(", ")}`
              : "Yuborish uchun telefon raqam yo'q"}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">SMS shablon</label>
            <div className="relative">
              <select
                value={picked}
                onChange={(e) => pick(e.target.value)}
                disabled={templatesLoading}
                className={`${FIELD_CLS} appearance-none pr-9 disabled:opacity-70`}
              >
                <option value="">{selectPlaceholder(templatesLoading, options.length, "Shablon yo'q", "Qidirish")}</option>
                {groups.map((g) => (
                  <optgroup key={g} label={g}>
                    {options
                      .filter((o) => o.group === g)
                      .map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
              <svg className="icon icon-sm pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <use href="#i-chevron-down" />
              </svg>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Xabar</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              className="w-full resize-y rounded-lg border border-border bg-secondary/20 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <div className="mt-1 text-sm text-muted-foreground">{text.length} / ∞</div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Orqaga
            </Button>
            <Button variant="primary" onClick={send} disabled={sending || recipients.length === 0}>
              {sending ? "Yuborilmoqda..." : "Saqlash"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
