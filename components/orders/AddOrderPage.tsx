"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ClipboardList, Plus, Users } from "lucide-react";
import { useOrders } from "@/components/orders/OrdersContext";
import { usePupils } from "@/components/orders/PupilsContext";
import { useToast } from "@/components/ui/Toast";
import StagePickerPopover, { STAGE_COLORS } from "@/components/orders/StagePickerPopover";
import StudentSearchSelect from "@/components/orders/StudentSearchSelect";
import { FormRowSelect, FormRowText } from "@/components/orders/FormRow";
import CustomFieldEditModal, { type CustomField } from "@/components/orders/CustomFieldEditModal";
import { COURSES, MODERATORS, ORDER_STAGES, type OrderStageKey } from "@/lib/ordersData";
import { useTeachers } from "@/hooks/useTeachers";

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
// Scope cut (disclosed): these definitions are visual/local only — there's
// no schema for arbitrary custom fields on Order yet, so they aren't sent to
// POST /api/orders when saving.

export default function AddOrderPage() {
  const router = useRouter();
  const { createOrder } = useOrders();
  const { pupils } = usePupils();
  // "O'qituvchi" ro'yxati — /api/teachers (Boshqaruv → Xodimlardagi haqiqiy
  // o'qituvchilar), AddOrderModal bilan bir xil manba.
  const { names: teacherNames } = useTeachers();
  const { showSuccess, showError } = useToast();
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
  const [editingField, setEditingField] = useState<{ scope: "order" | "student"; field: CustomField } | null>(null);

  const activeStage = stage ? ORDER_STAGES.find((s) => s.key === stage) : null;

  const addCustomField = (scope: "order" | "student") => {
    const field: CustomField = {
      id: crypto.randomUUID(),
      label: "Yangi maydon",
      type: "text",
      stages: ORDER_STAGES.map((s) => s.key),
      apiOnly: false,
    };
    const setter = scope === "order" ? setOrderCustomFields : setStudentCustomFields;
    setter((prev) => [...prev, field]);
    setEditingField({ scope, field });
  };

  const saveCustomField = (updated: CustomField) => {
    if (!editingField) return;
    const setter = editingField.scope === "order" ? setOrderCustomFields : setStudentCustomFields;
    setter((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
    setEditingField(null);
    showSuccess("Maydon sozlamalari saqlandi");
  };

  const handleSave = async () => {
    if (!course) {
      setError("Kurs majburiy");
      return;
    }
    if (!firstName.trim() && !lastName.trim()) {
      setError("Ism yoki Familiya kerak");
      return;
    }
    setSaving(true);
    const created = await createOrder({
      studentName: `${firstName} ${lastName}`.trim(),
      phone: phone.trim(),
      referral,
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
      showSuccess("Buyurtma muvaffaqiyatli saqlandi");
      router.push("/orders-list?layout=kanban");
    } else {
      showError("Buyurtmani saqlashda xatolik yuz berdi");
    }
  };

  return (
    <div className="container mx-auto max-w-[1600px] p-4 md:p-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="inline-flex items-center gap-1 p-1 rounded-lg border border-border bg-card mb-5">
            <button
              type="button"
              onClick={() => setActiveTab("asosiy")}
              className={`h-8 px-3 rounded-md text-sm font-medium ${activeTab === "asosiy" ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"}`}
            >
              Asosiy
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("sozlamalar")}
              className={`h-8 px-3 rounded-md text-sm font-medium ${activeTab === "sozlamalar" ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"}`}
            >
              Sozlamalar
            </button>
          </div>

          {activeTab === "sozlamalar" ? (
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                    <ClipboardList size={16} />
                  </span>
                  <span className="text-sm font-semibold">Buyurtma maydonlari</span>
                </div>
                <div className="space-y-2">
                  {orderCustomFields.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setEditingField({ scope: "order", field: f })}
                      className="w-full h-10 flex items-center rounded-lg border border-border bg-secondary/20 px-3 text-sm text-left hover:bg-secondary/30"
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => addCustomField("order")}
                  className="mt-2 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card text-sm font-medium hover:bg-secondary"
                >
                  <Plus size={14} /> Maydon qo&apos;shish
                </button>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                    <Users size={16} />
                  </span>
                  <span className="text-sm font-semibold">O&apos;quvchi maydonlari</span>
                </div>
                <div className="space-y-2">
                  {studentCustomFields.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setEditingField({ scope: "student", field: f })}
                      className="w-full h-10 flex items-center rounded-lg border border-border bg-secondary/20 px-3 text-sm text-left hover:bg-secondary/30"
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => addCustomField("student")}
                  className="mt-2 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card text-sm font-medium hover:bg-secondary"
                >
                  <Plus size={14} /> Maydon qo&apos;shish
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="relative mb-6">
                <button
                  type="button"
                  onClick={() => setStagePickerOpen((o) => !o)}
                  className="w-full flex items-center justify-between py-1.5"
                >
                  <span className="text-sm font-semibold">
                    {activeStage ? `${activeStage.emoji} ${activeStage.label}` : "Bosqichni tanlang"}
                  </span>
                  <svg className="icon icon-sm text-muted-foreground">
                    <use href="#i-chevron-down" />
                  </svg>
                </button>
                <div className="flex h-1 w-full gap-0.5 overflow-hidden rounded-full">
                  {ORDER_STAGES.map((st) => (
                    <div
                      key={st.key}
                      className="flex-1"
                      style={{ backgroundColor: STAGE_COLORS[st.key], opacity: !stage || stage === st.key ? 1 : 0.25 }}
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

              <div className="flex items-center gap-2 mb-1">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                  <ClipboardList size={16} />
                </span>
                <span className="text-sm font-semibold">Buyurtma ma&apos;lumotlari</span>
              </div>
              <FormRowSelect label="Mas'ul shaxs" value={moderator} onChange={setModerator} options={MODERATORS} />
              <FormRowSelect
                label="Kurs"
                required
                value={course}
                onChange={(v) => {
                  setCourse(v);
                  setError(null);
                }}
                options={COURSES}
              />
              <FormRowSelect label="O'qituvchi" value={teacher} onChange={setTeacher} options={teacherNames} />
              <StudentSearchSelect
                variant="row"
                label="Referal bergan o'quvchi"
                value={referral}
                onChange={setReferral}
                options={pupilNames}
              />

              <div className="flex items-center gap-2 mt-6 mb-1">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                  <Users size={16} />
                </span>
                <span className="text-sm font-semibold">O&apos;quvchi ma&apos;lumotlari</span>
              </div>
              <FormRowText
                label="Ism"
                value={firstName}
                onChange={(v) => {
                  setFirstName(v);
                  setError(null);
                }}
              />
              <FormRowText label="Familiya" value={lastName} onChange={setLastName} />
              <FormRowText label="Telefon" value={phone} onChange={setPhone} />

              {error && <div className="mt-3 text-sm text-red-600">⚠ {error}</div>}

              <div className="flex justify-end gap-2 mt-6">
                <Link
                  href="/orders-list?layout=kanban"
                  className="inline-flex items-center h-10 px-4 rounded-lg border border-border bg-card text-sm font-medium hover:bg-secondary/60"
                >
                  Orqaga
                </Link>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSave}
                  className="inline-flex items-center h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
                >
                  {saving ? "Saqlanmoqda..." : "Saqlash"}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-4 flex flex-col">
          <label className="text-sm font-semibold underline mb-2">Eslatma:</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={6}
            className="w-full flex-1 resize-none rounded-lg border border-border bg-secondary/20 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </div>

      {editingField && (
        <CustomFieldEditModal
          field={editingField.field}
          onClose={() => setEditingField(null)}
          onSave={saveCustomField}
        />
      )}
    </div>
  );
}
