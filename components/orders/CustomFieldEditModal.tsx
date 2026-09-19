"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { STAGE_COLORS } from "@/components/orders/StagePickerPopover";
import { ORDER_STAGES, type OrderStageKey } from "@/lib/ordersData";
import Select from "@/components/ui/Select";
import Modal, { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";

// "Tahrirlash" modal for a single custom field definition, opened by clicking
// a field row under the "Sozlamalar" tab (AddOrderPage.tsx) — reference:
// akademiya.edutizim.uz/orders/add > Sozlamalar > click an existing field.
// Configures the field's name/type/which pipeline stages require it/whether
// it's API-only.
//
// Ta'rifning O'ZI endi bazaga saqlanadi — chaqiruvchi (AddOrderPage.tsx) uni
// sozlamalar API'siga ("orders.custom-fields") yozadi. Shu bois bu yerdagi
// "Saqlash" haqiqiy: modal yopilishidan oldin so'rov yuboriladi va xato
// bo'lsa modal ochiq qoladi.

export type CustomFieldType = "text" | "number" | "switch" | "date" | "datetime" | "select" | "multiselect";

export interface CustomField {
  id: string;
  label: string;
  type: CustomFieldType;
  stages: OrderStageKey[];
  apiOnly: boolean;
}

const FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: "text", label: "Matn" },
  { value: "number", label: "Raqam" },
  { value: "switch", label: "Switch" },
  { value: "date", label: "Sana" },
  { value: "datetime", label: "Sana va vaqt" },
  { value: "select", label: "Tanlash" },
  { value: "multiselect", label: "Ko'p tanlovli funksiya" },
];

export interface CustomFieldEditModalProps {
  field: CustomField;
  onClose: () => void;
  onSave: (field: CustomField) => void | Promise<void>;
  /** Faqat mavjud (allaqachon saqlangan) maydon uchun beriladi. */
  onDelete?: () => void | Promise<void>;
}

export default function CustomFieldEditModal({ field, onClose, onSave, onDelete }: CustomFieldEditModalProps) {
  const { t } = useT();
  const modal = useModalClose(onClose);
  const [label, setLabel] = useState(field.label);
  const [type, setType] = useState<CustomFieldType>(field.type);
  const [stages, setStages] = useState<OrderStageKey[]>(field.stages);
  const [apiOnly, setApiOnly] = useState(field.apiOnly);
  const [stagesOpen, setStagesOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const toggleStage = (key: OrderStageKey) => {
    setStages((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const handleSave = async () => {
    setBusy(true);
    await onSave({ ...field, label: label.trim(), type, stages, apiOnly });
    setBusy(false);
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setBusy(true);
    await onDelete();
    setBusy(false);
  };

  return (
    <Modal onClose={onClose} controller={modal} bare zIndex={200} panelClassName="p-6 space-y-4">
        <h3 className="text-2xl font-semibold">{t("Tahrirlash")}</h3>

        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t("Maydon nomi")}
          className="w-full h-11 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />

        <Select value={type} onChange={(v) => setType(v as CustomFieldType)} options={FIELD_TYPES.map((tv) => ({ value: tv.value, label: tv.label }))} size="lg" />

        <div className="relative">
          <button
            type="button"
            onClick={() => setStagesOpen((o) => !o)}
            className="w-full h-11 flex items-center justify-between rounded-lg border border-border bg-background px-3 text-sm"
          >
            <span>{stages.length} ta bosqichda majburiy</span>
            <svg className="icon icon-sm text-muted-foreground">
              <use href="#i-chevron-down" />
            </svg>
          </button>
          {stagesOpen && (
            <div className="absolute z-30 mt-1 w-full rounded-lg border border-border shadow-xl overflow-hidden">
              {ORDER_STAGES.map((st) => (
                <label
                  key={st.key}
                  className="flex items-center gap-2.5 px-3 py-2.5 text-sm cursor-pointer text-white"
                  style={{ backgroundColor: STAGE_COLORS[st.key] }}
                >
                  <input
                    type="checkbox"
                    checked={stages.includes(st.key)}
                    onChange={() => toggleStage(st.key)}
                    className="h-4 w-4"
                  />
                  <span>
                    {st.emoji} {t(st.label)}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer pt-2 border-t border-border">
          <input
            type="checkbox"
            checked={apiOnly}
            onChange={(e) => setApiOnly(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          {t("Faqat api bilan")}
        </label>

        {/* DIQQAT: `mr-auto` bu loyihaning oldindan tayyorlangan Tailwind
            blobida yo'q — chapdagi tugmani ajratish uchun justify-between va
            bo'sh <span> ishlatiladi (OrdersPage.tsx dagi izohga qarang). */}
        <div className="flex items-center justify-between gap-2 pt-1">
          {onDelete ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="h-9 rounded-lg border border-border px-4 text-sm font-medium text-rose-600 hover:bg-rose-500/10 disabled:opacity-50 disabled:pointer-events-none"
            >
              {t("O'chirish")}
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={modal.close}>
              {t("Orqaga")}
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={busy}>
              {busy ? t("Saqlanmoqda...") : t("Saqlash")}
            </Button>
          </div>
        </div>
      </Modal>
  );
}
