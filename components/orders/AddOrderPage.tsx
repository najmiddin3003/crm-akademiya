"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Plus, Users } from "lucide-react";
import { useOrders } from "@/components/orders/OrdersContext";
import { usePupils } from "@/components/orders/PupilsContext";
import { useToast } from "@/components/ui/Toast";
import StagePickerPopover, { STAGE_COLORS } from "@/components/orders/StagePickerPopover";
import StudentSearchSelect from "@/components/orders/StudentSearchSelect";
import { FormRowSelect, FormRowText } from "@/components/orders/FormRow";
import SectionHeader from "@/components/orders/SectionHeader";
import CustomFieldEditModal, { type CustomField } from "@/components/orders/CustomFieldEditModal";
import { useModerators } from "@/hooks/useModerators";
import { useOfflineCourseList } from "@/hooks/useOfflineCourseList";
import { ORDER_STAGES, type OrderStageKey } from "@/lib/ordersData";
import { useTeachers } from "@/hooks/useTeachers";
import { useT } from "@/components/shared/Language";
import { pupilIdByName } from "@/lib/pupilsData";

// Full-page "Buyurtma qo'shish" flow reached from the Kanban toolbar's
// "Qo'shish" button (akademiya.edutizim.uz/orders/add reference) — a
// different field set/layout from the list view's AddOrderModal side drawer:
// compact label-left/value-right rows instead of boxed inputs, a stage
// picker + Ism/Familiya/Telefon/Mas'ul shaxs instead of a student search
// select. Both flows still create through the same shared
// buildOrderFromValues()/POST /api/orders, just with different fields
// populated (moderator/stage here; lessonDay/group/firstLesson there).
// The "Sozlamalar" tab is a custom field DEFINITION manager (per the
// akademiya.edutizim.uz/orders/add reference): each row is a field
// definition (name/type/which pipeline stages require it/API-only), edited
// via CustomFieldEditModal — not a place to fill in values for this order.
//
// Maydon ta'riflari BAZAGA saqlanadi: sozlamalar API'sining
// "orders.custom-fields" kaliti (GET/PUT /api/settings, MongoDB `settings`).
// Ilgari ular faqat React holatida yashardi — "Maydon sozlamalari saqlandi"
// toasti chiqardi, lekin sahifadan chiqish bilanoq yo'q bo'lardi.
// Eslatma: ta'riflar hozircha faqat SAQLANADI — buyurtmaning o'zida bunday
// maydonlar uchun sxema yo'q (lib/ordersData.ts dagi `Order`), shu bois ular
// POST /api/orders tanasiga qo'shilmaydi.

/** Sozlamalardagi kalit — ikkala ro'yxat bitta hujjatda saqlanadi. */
const CUSTOM_FIELDS_KEY = "orders.custom-fields";

/** Bazadan kelgan qiymatni ehtiyotkorlik bilan CustomField[] ga aylantiradi. */
function parseFields(raw: unknown): CustomField[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((f): f is Record<string, unknown> => Boolean(f) && typeof f === "object")
    .map((f) => ({
      id: String(f.id ?? crypto.randomUUID()),
      label: String(f.label ?? ""),
      type: (f.type ?? "text") as CustomField["type"],
      stages: Array.isArray(f.stages) ? (f.stages as CustomField["stages"]) : [],
      apiOnly: Boolean(f.apiOnly),
    }))
    .filter((f) => f.label);
}

export default function AddOrderPage() {
  const { t } = useT();
  const router = useRouter();
  const { createOrder } = useOrders();
  const { pupils, loading: pupilLoading, phoneOf } = usePupils();
  // "O'qituvchi" ro'yxati — /api/teachers (Boshqaruv → Xodimlardagi haqiqiy
  // o'qituvchilar), AddOrderModal bilan bir xil manba.
  const { names: teacherNames, loading: teacherLoading } = useTeachers();
  const { showSuccess, showError } = useToast();
  // Mas'ul shaxs va kurs ro'yxatlari bazadan.
  const { names: moderatorNames, loading: moderatorLoading } = useModerators();
  const { names: courseNames, loading: courseLoading } = useOfflineCourseList();
  const pupilNames = pupils.map((p) => `${p.firstName} ${p.lastName}`.trim());
  const [activeTab, setActiveTab] = useState<"asosiy" | "sozlamalar">("asosiy");
  const [stage, setStage] = useState<OrderStageKey | null>(null);
  const [stagePickerOpen, setStagePickerOpen] = useState(false);
  const [moderator, setModerator] = useState("");
  const [course, setCourse] = useState("");
  const [teacher, setTeacher] = useState("");
  const [referral, setReferral] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [orderCustomFields, setOrderCustomFields] = useState<CustomField[]>([]);
  const [studentCustomFields, setStudentCustomFields] = useState<CustomField[]>([]);
  // `isNew` — modal bekor qilinsa ro'yxatga hech narsa qo'shilmasin: ilgari
  // maydon avval qo'shilib, keyin tahrirlanardi va "Bekor qilish" bosilganda
  // "Yangi maydon" nomli bo'sh yozuv qolib ketardi.
  const [editingField, setEditingField] = useState<{ scope: "order" | "student"; field: CustomField; isNew: boolean } | null>(null);

  const activeStage = stage ? ORDER_STAGES.find((s) => s.key === stage) : null;

  // Saqlangan ta'riflarni bazadan yuklaymiz (hooks/ dagi naqsh: cancelled bayrog'i).
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/settings?key=${CUSTOM_FIELDS_KEY}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.ok) return;
        setOrderCustomFields(parseFields(d.values?.order));
        setStudentCustomFields(parseFields(d.values?.student));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  /** Ikkala ro'yxatni bitta sozlama hujjatiga yozadi. */
  const persistFields = useCallback(
    async (order: CustomField[], student: CustomField[]): Promise<boolean> => {
      try {
        const res = await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: CUSTOM_FIELDS_KEY, values: { order, student } }),
        });
        const data = await res.json();
        return Boolean(data.ok);
      } catch {
        return false;
      }
    },
    [],
  );

  const addCustomField = (scope: "order" | "student") => {
    setEditingField({
      scope,
      isNew: true,
      field: {
        id: crypto.randomUUID(),
        label: t("Yangi maydon"),
        type: "text",
        stages: ORDER_STAGES.map((s) => s.key),
        apiOnly: false,
      },
    });
  };

  const saveCustomField = async (updated: CustomField) => {
    if (!editingField) return;
    const isOrder = editingField.scope === "order";
    const current = isOrder ? orderCustomFields : studentCustomFields;
    const next = editingField.isNew
      ? [...current, updated]
      : current.map((f) => (f.id === updated.id ? updated : f));
    const ok = await persistFields(
      isOrder ? next : orderCustomFields,
      isOrder ? studentCustomFields : next,
    );
    if (!ok) {
      showError(t("Maydon sozlamalarini saqlab bo'lmadi"));
      return;
    }
    (isOrder ? setOrderCustomFields : setStudentCustomFields)(next);
    setEditingField(null);
    showSuccess(t("Maydon sozlamalari saqlandi"));
  };

  const deleteCustomField = async () => {
    if (!editingField || editingField.isNew) return;
    const isOrder = editingField.scope === "order";
    const current = isOrder ? orderCustomFields : studentCustomFields;
    const next = current.filter((f) => f.id !== editingField.field.id);
    const ok = await persistFields(
      isOrder ? next : orderCustomFields,
      isOrder ? studentCustomFields : next,
    );
    if (!ok) {
      showError(t("Maydonni o'chirib bo'lmadi"));
      return;
    }
    (isOrder ? setOrderCustomFields : setStudentCustomFields)(next);
    setEditingField(null);
    showSuccess(t("Maydon o'chirildi"));
  };

  const handleSave = async () => {
    if (!course) {
      setError(t("Kurs majburiy"));
      return;
    }
    if (!firstName.trim() && !lastName.trim()) {
      setError(t("Ism yoki Familiya kerak"));
      return;
    }
    setSaving(true);
    const created = await createOrder({
      studentName: `${firstName} ${lastName}`.trim(),
      phone: phone.trim(),
      referral,
      referralPupilId: pupilIdByName(pupils, referral),
      course,
      lessonDay: "",
      lessonStartTime: "",
      teacher,
      group: "",
      firstLessonDate: "",
      firstLessonTime: "",
      note,
      moderator,
      stage: stage ?? undefined,
    });
    setSaving(false);
    if (created) {
      showSuccess(t("Buyurtma muvaffaqiyatli saqlandi"));
      router.push("/orders-list?layout=kanban");
    } else {
      showError(t("Buyurtmani saqlashda xatolik yuz berdi"));
    }
  };

  // Tab tugmasi — referensda ikkalasi ham fon bilan: faoli ko'k, ikkinchisi
  // xira (--secondary). Balandligi 32, radius 8, ichki bo'shliq 4/20.
  const tabCls = (on: boolean) =>
    `h-8 rounded-lg text-sm ${on ? "bg-primary text-white font-semibold" : "bg-secondary text-muted-foreground font-medium"}`;

  return (
    // Referens (akademiya.edutizim.uz/orders/add): chapda qat'iy 514px
    // ustun va uning o'ng chekkasida to'liq balandlikdagi ajratgich;
    // o'ngdagi bo'sh joyning PASTIGA "Eslatma" paneli yopishtirilgan.
    <div className="flex h-full min-h-0">
      <div className="flex w-[514px] shrink-0 flex-col border-r border-border px-2">
        {/* Tab paneli — referensda 12px radius, 4px ichki bo'shliq, 4px oraliq
            va panelning to'liq kengligi (aylantiriladigan qismdan tashqarida) */}
        <div className="shrink-0">
          <div className="flex gap-1 rounded-xl border border-border bg-background p-1">
            <button type="button" onClick={() => setActiveTab("asosiy")} style={{ paddingLeft: 20, paddingRight: 20 }} className={tabCls(activeTab === "asosiy")}>
              {t("Asosiy")}
            </button>
            <button type="button" onClick={() => setActiveTab("sozlamalar")} style={{ paddingLeft: 20, paddingRight: 20 }} className={tabCls(activeTab === "sozlamalar")}>
              {t("Sozlamalar")}
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">

          {activeTab === "sozlamalar" ? (
            <div className="space-y-6">
              <div>
                <div className="mb-3">
                  <SectionHeader icon={ClipboardList} title={t("Buyurtma maydonlari")} />
                </div>
                <div className="space-y-2">
                  {orderCustomFields.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setEditingField({ scope: "order", field: f, isNew: false })}
                      className="w-full h-10 flex items-center rounded-lg border border-border bg-secondary/20 px-3 text-sm text-left hover:bg-secondary/30"
                    >
                      {t(f.label)}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => addCustomField("order")}
                  className="mt-2 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card text-sm font-medium hover:bg-secondary"
                >
                  <Plus size={14} />{" "}{t("Maydon qo'shish")}
                </button>
              </div>

              <div>
                <div className="mb-3">
                  <SectionHeader icon={Users} title={t("O'quvchi maydonlari")} />
                </div>
                <div className="space-y-2">
                  {studentCustomFields.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setEditingField({ scope: "student", field: f, isNew: false })}
                      className="w-full h-10 flex items-center rounded-lg border border-border bg-secondary/20 px-3 text-sm text-left hover:bg-secondary/30"
                    >
                      {t(f.label)}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => addCustomField("student")}
                  className="mt-2 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card text-sm font-medium hover:bg-secondary"
                >
                  <Plus size={14} />{" "}{t("Maydon qo'shish")}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Referens: sarlavha 16px/600 va undan 4px pastda 8px'lik
                  chiziq — bo'laklar oralig'i YO'Q, bosqich tanlanmaguncha
                  hammasi kulrang (#dadada). */}
              <div className="relative py-2">
                <button
                  type="button"
                  onClick={() => setStagePickerOpen((o) => !o)}
                  className="mb-1 flex h-6 w-full items-center justify-between"
                >
                  <span className="text-base font-semibold">
                    {activeStage ? `${activeStage.emoji} ${activeStage.label}` : "Bosqichni tanlang"}
                  </span>
                  <svg className="icon icon-sm text-muted-foreground">
                    <use href="#i-chevron-down" />
                  </svg>
                </button>
                <div className="flex h-2 w-full overflow-hidden rounded-full">
                  {ORDER_STAGES.map((st) => (
                    <div
                      key={st.key}
                      className="flex-1"
                      style={{ backgroundColor: stage === st.key ? STAGE_COLORS[st.key] : "#dadada" }}
                    />
                  ))}
                </div>
                {stagePickerOpen && (
                  <StagePickerPopover
                    value={stage ?? "bir_oylay"}
                    onChange={(s) => {
                      setStage(s);
                      setStagePickerOpen(false);
                    }}
                    onClose={() => setStagePickerOpen(false)}
                  />
                )}
              </div>

              <SectionHeader icon={ClipboardList} title={t("Buyurtma ma'lumotlari")} />
              <FormRowSelect label={t("Mas'ul shaxs")} value={moderator} onChange={setModerator} options={moderatorNames} loading={moderatorLoading} />
              <FormRowSelect
                label={t("Kurs")}
                required
                value={course}
                onChange={(v) => {
                  setCourse(v);
                  setError(null);
                }}
                options={courseNames}
                loading={courseLoading}
              />
              <FormRowSelect label={t("O'qituvchi")} value={teacher} onChange={setTeacher} options={teacherNames} loading={teacherLoading} />
              <StudentSearchSelect
                variant="row"
                label={t("Referal bergan o'quvchi")}
                value={referral}
                onChange={setReferral}
                options={pupilNames}
                placeholder="..."
                searchPlaceholder="O'quvchini qidirish"
                loading={pupilLoading}
                // Telefon qidiruvga ham qo'shiladi (AddOrderModal bilan bir xil).
                subtitleOf={phoneOf}
              />

              {/* Referensda ikki bo'lim orasida 48px bo'shliq va 1px ajratgich bor */}
              <div className="mb-12" />
              <div className="border-t border-border" />
              <SectionHeader icon={Users} title={t("O'quvchi ma'lumotlari")} className="pt-1 pb-px" />
              <FormRowText
                label={t("Ism")}
                value={firstName}
                onChange={(v) => {
                  setFirstName(v);
                  setError(null);
                }}
              />
              <FormRowText label={t("Familiya")} value={lastName} onChange={setLastName} />
              <FormRowText label={t("Telefon")} value={phone} onChange={setPhone} />

              {error && <div className="mt-3 text-sm text-red-600">⚠ {error}</div>}
            </>
          )}
        </div>

        {/* Referensda "Saqlash" chap panelning eng pastida, chapga tekislangan
            va yolg'iz turadi (orqaga qaytish header'dagi strelka orqali). */}
        <div className="shrink-0 pb-2">
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            style={{ paddingLeft: 20, paddingRight: 20 }}
            className="inline-flex h-9 items-center rounded-lg bg-primary text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {saving ? t("Saqlanmoqda...") : t("Saqlash")}
          </button>
        </div>
      </div>

      {/* O'ng tomon — referensda faqat pastga yopishtirilgan "Eslatma" paneli */}
      <div className="flex min-w-0 flex-1 flex-col px-3 pt-3 pb-2">
        <div className="mt-auto rounded-md border border-border">
          <div className="flex items-start gap-2.5 rounded-[5px] bg-secondary p-2">
            <span className="shrink-0 text-[15px] leading-[23px] text-primary underline">{t("Eslatma:")}</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{ padding: 0 }}
              className="min-h-20 w-full flex-1 resize-none border-0 bg-transparent text-sm leading-[23px] focus:outline-none"
            />
          </div>
        </div>
      </div>

      {editingField && (
        <CustomFieldEditModal
          field={editingField.field}
          onClose={() => setEditingField(null)}
          onSave={saveCustomField}
          onDelete={editingField.isNew ? undefined : deleteCustomField}
        />
      )}
    </div>
  );
}
