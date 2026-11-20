"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { Chip, Field, FieldHint, FieldWarning, MoneyField, Segmented, TextInput } from "@/components/v2/form/fields";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { CATEGORY_OPTIONS, CUSTOMER_TYPES, MAIN_TYPES } from "@/constants/transactionTypes";
import { invalidateTransactionTypes } from "@/hooks/useTransactionTypes";
import type { TransactionType } from "@/lib/transactionTypes";

// YANGI VERSIYA — «Kirim-chiqim toifalari» → qo'shish / tahrirlash oynasi (20.11.2026).
//
// Eski versiyada bu alohida sahifa (components/finance/TransactionTypeFormPage.tsx,
// /finance-tx-types/add va /[id]/edit) — mantiq AYNAN o'sha yerdan ko'chirildi:
//   • so'rov: POST /api/transaction-types yoki PATCH /api/transaction-types/:id, tanasi
//     { name, minAmount, maxAmount, customerType: string[], category, mainType } — bir xil;
//   • «Mijoz» ko'p tanlovli, sukut «Boshqa», bo'sh ro'yxat SAQLANMAYDI (tugma o'chiq);
//   • bo'lim (`mainType`) formada tanlanmaydi — yangi turda ochiq tab, tahrirda turning o'zi;
//   • kirim turida «Xodim» belgilanmasa — o'qituvchi foizli oyligiga tushmaslik ogohlantirishi;
//   • saqlangach `invalidateTransactionTypes()` — kassa oynalari yangi ro'yxatni oladi.

/** Eski yozuvlarda `customerType` — bitta satr; ro'yxatga keltiriladi, bo'sh bo'lsa «Boshqa». */
function initialCustomers(tv: TransactionType | null): string[] {
  if (!tv) return [CUSTOMER_TYPES[0]];
  const saved = Array.isArray(tv.customerType) ? tv.customerType : tv.customerType ? [tv.customerType] : [];
  return saved.length > 0 ? saved : [CUSTOMER_TYPES[0]];
}

export default function TransactionTypeDialogV2({
  type,
  mainType: newMainType,
  onClose,
  onSaved,
}: {
  /** Tahrirlanadigan tur; `null` — yangi. */
  type: TransactionType | null;
  /** Yangi tur qaysi bo'limga (ochiq tab). */
  mainType: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const modal = useModalClose(onClose, "center");
  const editing = type !== null;

  const [name, setName] = useState(type?.name ?? "");
  const [minAmount, setMinAmount] = useState(type?.minAmount ? String(type.minAmount) : "");
  const [maxAmount, setMaxAmount] = useState(type?.maxAmount ? String(type.maxAmount) : "");
  const [customerTypes, setCustomerTypes] = useState<string[]>(() => initialCustomers(type));
  const [category, setCategory] = useState<string>(type?.category ?? CATEGORY_OPTIONS[0]);
  const mainType = type?.mainType ?? newMainType;
  const [nameErr, setNameErr] = useState("");
  const [saving, setSaving] = useState(false);

  const initial = { name: type?.name ?? "", min: type?.minAmount ? String(type.minAmount) : "", max: type?.maxAmount ? String(type.maxAmount) : "", cust: initialCustomers(type).join("|"), cat: type?.category ?? CATEGORY_OPTIONS[0] };
  const dirty = name !== initial.name || minAmount !== initial.min || maxAmount !== initial.max || customerTypes.join("|") !== initial.cust || category !== initial.cat;

  function toggleCustomerType(c: string) {
    setCustomerTypes((prev) =>
      prev.includes(c)
        ? prev.filter((x) => x !== c)
        : // Tartib CUSTOMER_TYPES bo'yicha — bir xil tanlov doim bir xil ko'rinsin (server ham shunday tozalaydi).
          CUSTOMER_TYPES.filter((x: string) => x === c || prev.includes(x)),
    );
  }

  const hasStudent = customerTypes.includes("O'quvchilar");
  const hasEmployee = customerTypes.includes("Xodim");
  const hasThird = customerTypes.includes("Uchinchi shaxs");
  const canSave = customerTypes.length > 0;

  /** Kassa oynasida nima chiqishi — odam tilida (eski formadagi izoh). */
  const audienceHint = (() => {
    const parts: string[] = [];
    if (hasStudent) parts.push(t("«O'quvchini tanlang»"));
    // Kirim oynasida xodim tanlovi O'QITUVCHILAR ro'yxati (foizli oylik shu ism bo'yicha), chiqimda — butun xodimlar.
    if (hasEmployee) parts.push(mainType === "kirim" ? t("«O'qituvchini tanlang»") : t("«Xodimni tanlang»"));
    if (hasThird) parts.push(t("(Qiymat + Oy) qatorlari"));
    if (parts.length > 0) return t("Kassa oynasida chiqadi: {list}.", { list: parts.join(" · ") });
    if (customerTypes.length === 0) return "";
    return t("Kassa oynasida hech qanday tanlov chiqmaydi — pul odamga biriktirilmaydi.");
  })();

  const teacherWarning =
    mainType === "kirim" && customerTypes.length > 0 && !hasEmployee
      ? t("«Xodim» belgilanmagan — bu turdagi to'lovda o'qituvchi tanlanmaydi va uning foizli oyligiga qo'shilmaydi.")
      : "";

  async function save() {
    if (saving) return;
    if (!name.trim()) {
      setNameErr(t("Ismni kiriting"));
      return;
    }
    // Tugma o'chiq bo'lsa ham ikkinchi qorovul (Enter bilan yetib kelmasin).
    if (!canSave) {
      showError(t("«Mijoz» dan kamida bittasini belgilang"));
      return;
    }
    setSaving(true);
    const url = type ? `/api/transaction-types/${type.id}` : "/api/transaction-types";
    try {
      const res = await fetch(url, {
        method: type ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          minAmount: minAmount ? Number(minAmount) : 0,
          maxAmount: maxAmount ? Number(maxAmount) : 0,
          customerType: customerTypes,
          category,
          mainType,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(t(data.error || "Saqlanmadi"));
        setSaving(false);
        return;
      }
      invalidateTransactionTypes();
      showSuccess(editing ? t("Tranzaksiya turi yangilandi") : t("Tranzaksiya turi qo'shildi"));
      setSaving(false);
      onSaved();
      modal.close();
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
      setSaving(false);
    }
  }

  const sectionLabel = t(MAIN_TYPES.find((m) => m.key === mainType)?.label ?? mainType);

  return (
    <V2Dialog
      title={editing ? t("Toifani tahrirlash") : t("Yangi toifa")}
      subtitle={t("Bo'lim: {name}", { name: sectionLabel })}
      onClose={onClose}
      controller={modal}
      dirty={dirty}
      saving={saving}
      onSubmit={() => void save()}
      width={540}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={saving} className={secondaryBtn}>
            {t("Bekor qilish")}
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !canSave}
            title={canSave ? undefined : t("«Mijoz» dan kamida bittasini belgilang")}
            className={`${primaryBtn} disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {saving ? t("Saqlanmoqda…") : editing ? t("Saqlash") : t("Qo'shish")}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <Field label={t("Toifa nomi")} htmlFor="txt-name" error={nameErr || undefined}>
          <TextInput
            id="txt-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameErr("");
            }}
            state={nameErr ? "error" : "default"}
            autoComplete="off"
            placeholder={t("Masalan: Kitob")}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("Minimal miqdor")} optional htmlFor="txt-min">
            <MoneyField id="txt-min" compact value={minAmount} onChange={setMinAmount} />
          </Field>
          <Field label={t("Maksimal miqdor")} optional htmlFor="txt-max">
            <MoneyField id="txt-max" compact value={maxAmount} onChange={setMaxAmount} />
          </Field>
        </div>

        {/* MIJOZ — ko'p tanlovli; aynan shu belgilar kassa oynasida qaysi tanlov chiqishini hal qiladi (lib/txTarget.ts). */}
        <div>
          <div className="mb-1.5 text-v2-small font-medium text-v2-text">{t("Mijoz")}</div>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t("Mijoz")}>
            {CUSTOMER_TYPES.map((c: string) => (
              <Chip key={c} on={customerTypes.includes(c)} onClick={() => toggleCustomerType(c)}>
                {t(c)}
              </Chip>
            ))}
          </div>
          {canSave ? (
            <FieldHint>{audienceHint}</FieldHint>
          ) : (
            <p role="alert" className="mt-1.5 text-v2-caption font-normal text-v2-danger">
              {t("Kamida bittasini belgilang — «Mijoz» bo'sh qolsa tur saqlanmaydi.")}
            </p>
          )}
          {teacherWarning && <FieldWarning>{teacherWarning}</FieldWarning>}
        </div>

        <Field label={t("Kategoriyasi")}>
          <Segmented
            label={t("Kategoriyasi")}
            value={category}
            onChange={setCategory}
            options={CATEGORY_OPTIONS.map((c: string) => ({ value: c, label: t(c), dot: c === "Chiqim" ? "bg-v2-danger" : "bg-v2-success" }))}
          />
        </Field>
      </div>
    </V2Dialog>
  );
}
